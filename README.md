# Documentação da API

## Rastreio sob demanda

### Método
`POST /api/track/batch`

### Headers
```http
Content-Type: application/json
```

### Body
```json
{
  "codes": ["YB754713088BR", "AA123456789BR"]
}
```

## Painel de configuração

A interface web tem duas áreas (botões no topo):

- **Rastrear** — consulta em lote sob demanda (a tela original).
- **Painel** — gerenciamento completo do serviço de webhook, autenticado pela
  sua chave de API (`Authorization: Apikey ...`): criar/pausar endpoints (com
  exibição única do signing secret), criar perfis de monitoramento, inscrever
  e encerrar códigos, acompanhar o histórico de entregas com reenvio de
  falhas, e criar/revogar chaves de API.

A primeira chave é criada pela CLI (`npm run webhooks:create-api-key`); as
demais podem ser criadas pelo próprio painel.

## Rastreio via webhook (assinaturas)

Serviço próprio de monitoramento contínuo: você inscreve códigos, nós verificamos
periodicamente (reaproveitando o mesmo cliente Wonca usado no rastreio sob
demanda) e entregamos um POST assinado ao seu endpoint sempre que os dados
mudarem. Não depende do recurso de webhook da Wonca — a Wonca aqui é só a fonte
de dados por trás do endpoint `Track`.

### 0. Pré-requisitos (uma vez)

```bash
# 1. Configure DATABASE_URL no .env (Postgres — Neon ou Vercel Postgres)
# 2. Aplique o schema
npm run db:migrate

# 3. Crie sua primeira chave de API (imprime a chave em texto puro uma única vez)
npm run webhooks:create-api-key -- "minha-chave"
```

Todas as rotas abaixo (exceto `/api/cron/run`) exigem o header:
```http
Authorization: Apikey SUA_CHAVE_AQUI
```

### 1. Crie um endpoint de webhook
`POST /api/webhooks/endpoints`
```json
{ "url": "https://seu-servidor.com/webhooks/correios", "headers": { "X-Custom": "valor" } }
```
Resposta (o `signingSecret` só aparece nesta resposta, guarde-o):
```json
{ "id": "...", "url": "...", "signingSecret": "...", "active": true }
```
`PATCH /api/webhooks/endpoints/:id/active` com `{ "active": false }` pausa/reativa manualmente.

### 2. Crie um perfil de monitoramento
`POST /api/webhooks/profiles`
```json
{ "name": "padrao", "frequencyHours": 4, "windowHours": 168, "stopOnDelivered": true }
```
- `frequencyHours`: de 1 a 12, intervalo entre verificações.
- `windowHours`: opcional, encerra o monitoramento do código após esse período.
- `stopOnDelivered`: encerra assim que detectarmos evento de entrega (heurística por palavra-chave na última descrição).

### 3. Inscreva códigos de rastreio
`POST /api/tracking-subscriptions`
```json
{
  "endpointId": "...",
  "profileId": "...",
  "codes": ["AA361812099BR", "NB552687923BR"]
}
```
Regras: até 100 códigos por requisição, formato `AA123456789BR`, lote inteiro é
rejeitado se algum código for inválido, upsert idempotente por
(endpoint, perfil, código).

`GET /api/tracking-subscriptions` lista as inscrições.
`DELETE /api/tracking-subscriptions` com `{ "ids": ["subscriptionId", ...] }`
encerra as inscrições informadas.

### Rotas de gerenciamento (usadas pelo painel)

- `GET /api/webhooks/keys` · `POST /api/webhooks/keys` (`{ "name": "..." }`,
  retorna a chave em texto puro uma única vez) · `DELETE /api/webhooks/keys/:id`
  (revoga; não permite revogar a chave da própria requisição nem a última ativa)
- `GET /api/webhooks/deliveries?endpointId=&limit=` — histórico de entregas
- `POST /api/webhooks/deliveries/:id/redeliver` — reenfileira uma entrega

### 4. Receba eventos
POST assinado no seu endpoint quando os dados mudarem:
```json
{
  "event_id": "...",
  "type": "tracking.updated",
  "code": "AA361812099BR",
  "carrier": "CARRIER_CORREIOS",
  "checked_at": "2026-07-15T15:30:00Z",
  "payload": { "code": "AA361812099BR", "carrier": "CARRIER_CORREIOS", "lastUpdate": "...", "events": [] }
}
```

Headers:
| Header | Descrição |
|---|---|
| `X-Webhook-Timestamp` | Timestamp Unix (segundos) usado na assinatura |
| `X-Webhook-Algorithm` | Sempre `hmac-sha256` |
| `X-Webhook-Signature` | HMAC-SHA256 hex de `"{timestamp}.{body}"` |
| `X-Webhook-Event-Id` | ID do evento |
| `X-Webhook-Delivery-Id` | ID desta tentativa de entrega |

Responda com um status `2xx` em até 10s. Falhas de rede, `429` e `5xx` são
reentregues até 5 vezes com backoff exponencial (30s, 2min, 10min, 30min, 1h);
outros `4xx` falham de imediato. Após 10 falhas consecutivas o endpoint é
pausado automaticamente (reative via `PATCH /api/webhooks/endpoints/:id/active`).

### 5. Verifique a assinatura
```js
const crypto = require('node:crypto');

function isValidSignature(rawBody, timestamp, signature, signingSecret) {
  const expected = crypto
    .createHmac('sha256', signingSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```
Assine sempre os bytes brutos do corpo recebido — não faça `JSON.parse` e
serialize de novo antes de verificar.

### 6. Agendamento das verificações

`POST /api/cron/run` (ou `GET`, que é como o Vercel Cron invoca) roda uma
rodada de verificações + reentregas pendentes. Protegido por
`Authorization: Bearer $CRON_SECRET`. O `vercel.json` já registra esse cron
a cada hora — no plano Hobby da Vercel, Cron Jobs só disparam uma vez por dia;
para a granularidade de 1-12h descrita nos perfis, é necessário o plano Pro
(cron por hora/minuto) ou um agendador externo (GitHub Actions, cron-job.org,
etc.) chamando esse mesmo endpoint.

### Erros
```json
{ "code": "invalid_argument", "message": "invalid tracking code: ABC123" }
```
| Código | HTTP | Quando |
|---|---|---|
| `unauthenticated` | 401 | `Authorization` ausente/inválido |
| `invalid_argument` | 400 | Código malformado, mais de 100 códigos, campos ausentes |
| `not_found` | 404 | Endpoint/perfil/inscrição inexistente |

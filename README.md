# Documentação da API

## Rastreio sob demanda

### Método
`POST /api/track/batch`

### Headers
```http
Content-Type: application/json
Authorization: Apikey SUA_CHAVE_AQUI
```

### Body
```json
{
  "codes": ["YB754713088BR", "AA123456789BR"]
}
```

## Painel

Acesso via login (e-mail/senha) em `/login`. O primeiro usuário é criado pela
CLI (`npm run auth:create-user -- email@empresa.com senha`); demais telas
(Webhooks, Chaves de API, Documentação, etc.) ficam atrás desse login, dentro
do painel.

Dentro do painel, **Webhooks** reúne o gerenciamento completo do serviço:
criar/pausar/editar/testar endpoints (com exibição única do signing secret),
criar perfis de monitoramento, inscrever e encerrar códigos, e acompanhar o
histórico de entregas com reenvio de falhas. **Chaves de API** cria/revoga
chaves usadas para autenticação programática (`Authorization: Apikey ...`)
tanto na API de rastreio quanto nas rotas de Webhooks — a primeira chave
também pode ser criada pela CLI (`npm run webhooks:create-api-key`) para uso
administrativo, mas o fluxo normal é criar pelo próprio painel.

## Provedor de rastreio alternativo (scraper próprio, sem Wonca)

Além da Wonca, existe um segundo provedor de dados: `TRACKING_PROVIDER=scraper`
consulta diretamente o site público de rastreio dos Correios
(`rastreamento.correios.com.br`), resolve o captcha da página e usa a mesma
resposta JSON que os Correios retornam — sem custo por verificação.

**Leia antes de usar em produção:**
- Isso **não é uma integração oficial** e não tem contrato/SLA com os
  Correios. O comunicado oficial deles ([link](https://www.correios.com.br/central-de-informacoes/boletim-aos-clientes/correios-aprimoram-ciberseguranca-para-rastreamento-de-pacotes))
  diz explicitamente que a API oficial (Rastro) foi restrita "para impedir
  que terceiros acessem informações... e reduzir o uso indevido por sites e
  aplicativos não autorizados" — este scraper é exatamente esse uso indevido
  do ponto de vista deles. Pode parar de funcionar sem aviso a qualquer
  momento (mudança de HTML, tipo de captcha, bloqueio por IP/volume).
- O captcha é resolvido por OCR (`CAPTCHA_SOLVER=ocr`, padrão, grátis) — na
  prática **não é 100% confiável**, erra ocasionalmente por confusão de
  caracteres parecidos (l/i, f/t, c/e). O client tenta de novo com um
  captcha novo até `SCRAPER_MAX_CAPTCHA_RETRIES` vezes antes de desistir
  daquela verificação — como o rastreio de webhook é periódico, uma falha
  não é fatal, só tenta de novo no próximo ciclo agendado. Para maior
  confiabilidade, configure `CAPTCHA_SOLVER=2captcha` (ou `anticaptcha`) com
  `CAPTCHA_API_KEY` — serviço pago de resolução (~US$1-3 por 1000).
- `SCRAPER_REQUEST_DELAY_MS` (padrão 1500ms) limita a taxa de requisições
  por verificação — reduz o risco de bloqueio por volume, mas não elimina.
- A Wonca continua sendo o padrão (`TRACKING_PROVIDER=wonca`); trocar de
  provedor é só mudar essa variável, nenhum outro código muda.

## Provedor `crnn` (captcha resolvido por serviço externo)

`TRACKING_PROVIDER=crnn` usa o mesmo scraping do site dos Correios, mas
delega a resolução do captcha via HTTP a uma instância do
[correios-rastreamento](https://github.com/opastorello/correios-rastreamento)
(Python/FastAPI), que resolve com uma CRNN treinada especificamente para o
captcha Securimage dos Correios (~99,6% de acurácia) em vez de OCR genérico.

- `RASTREAMENTO_SERVICE_URL` — URL base da instância (ex.: `http://localhost:8003`
  quando rodando via `docker compose up` no próprio repo do correios-rastreamento).
- `RASTREAMENTO_SERVICE_TOKEN` — só necessário se essa instância tiver
  `API_TOKEN` configurado.

Mesmas ressalvas do provedor `scraper` se aplicam (uso não-oficial, sujeito a
mudanças sem aviso). A vantagem é apenas a taxa de acerto do captcha; a
resolução em si roda fora do processo do `api_correios`, então essa instância
precisa estar disponível (local via Docker, ou hospedada) para o provedor
funcionar.

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

Todas as rotas abaixo (exceto `/api/cron/run`) aceitam a sessão do painel
(navegador logado) ou o header:
```http
Authorization: Apikey SUA_CHAVE_AQUI
```
As rotas de `/api/webhooks/keys` (criar/listar/revogar chaves) exigem sessão
de login — uma chave de API não pode ser usada para mintar outras chaves.

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

E-mail: verify@cronos.local
Senha: SenhaForte123
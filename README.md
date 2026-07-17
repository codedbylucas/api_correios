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

Lotes com 2 ou mais códigos são resolvidos com um único captcha compartilhado
(até 20 códigos por captcha, em lotes sequenciais para lotes maiores) quando o
provedor configurado suporta isso — ver "Provedores de rastreio" abaixo. O
formato de resposta é o mesmo independente disso.

Pra testar sem escrever código, use a tela **Rastreios** dentro do painel
(`/panel/rastreios`) — aceita sessão do navegador, sem precisar de API key.

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

## Provedores de rastreio

Não há integração com serviço pago de terceiros — o rastreio é feito
diretamente contra o site público dos Correios (`rastreamento.correios.com.br`),
resolvendo o captcha da página e usando a mesma resposta JSON que os Correios
retornam. Dois provedores implementam isso, escolhidos por `TRACKING_PROVIDER`:

**`crnn` (padrão, recomendado)** — delega a resolução do captcha via HTTP a
uma instância do `correios-rastreamento`, vendorizado neste repo em
[`services/correios-rastreamento/`](services/correios-rastreamento/)
(Python/FastAPI + CRNN treinada especificamente para o captcha Securimage dos
Correios, ~99,6% de acurácia — bem mais confiável que OCR genérico). Também é
esse provedor que faz a otimização de lote (1 captcha para até 20 códigos).
- `RASTREAMENTO_SERVICE_URL` — URL base da instância (ex.: `http://localhost:8003`
  rodando localmente via `docker compose up` dentro de `services/correios-rastreamento/`).
- `RASTREAMENTO_SERVICE_TOKEN` — só necessário se essa instância tiver
  `API_TOKEN` configurado.
- **Rodando localmente:** em um terminal, `cd services/correios-rastreamento && docker compose up`
  (sobe em `localhost:8003`); em outro, `npm run dev` na raiz do repo com
  `TRACKING_PROVIDER=crnn` e `RASTREAMENTO_SERVICE_URL=http://localhost:8003` no `.env`.
- **Produção:** ver "Deploy em VPS com Coolify" abaixo — o `docker-compose.yml`
  da raiz já sobe essa instância junto com o resto da stack, acessível só pela
  rede interna do Docker (sem precisar de `RASTREAMENTO_SERVICE_TOKEN`, já que
  não fica exposta pra fora). Se preferir hospedar em outro lugar (Railway,
  Fly.io, etc.), o `Dockerfile` vendorizado em `services/correios-rastreamento/`
  funciona standalone também — só apontar `RASTREAMENTO_SERVICE_URL` (e
  `RASTREAMENTO_SERVICE_TOKEN` se aplicável) pra instância pública.

**`scraper`** — mesmo scraping, mas resolve o captcha localmente no processo
Node (`CAPTCHA_SOLVER=ocr`, Tesseract, grátis mas menos confiável — erra
ocasionalmente por confusão de caracteres parecidos como l/i, f/t, c/e — ou
`CAPTCHA_SOLVER=2captcha`/`anticaptcha` com `CAPTCHA_API_KEY`, serviço pago
~US$1-3 por 1000). Não depende de nenhum serviço externo rodando. Não
implementa a otimização de lote — cada código é 1 requisição e 1 captcha.
- `SCRAPER_MAX_CAPTCHA_RETRIES` — tentativas com captcha novo antes de desistir.
- `SCRAPER_REQUEST_DELAY_MS` (padrão 1500ms) — limita a taxa de requisições.

**Leia antes de usar qualquer um dos dois em produção:** isso **não é uma
integração oficial** e não tem contrato/SLA com os Correios. O comunicado
oficial deles ([link](https://www.correios.com.br/central-de-informacoes/boletim-aos-clientes/correios-aprimoram-ciberseguranca-para-rastreamento-de-pacotes))
diz explicitamente que a API oficial (Rastro) foi restrita "para impedir que
terceiros acessem informações... e reduzir o uso indevido por sites e
aplicativos não autorizados" — este scraping é exatamente esse uso indevido do
ponto de vista deles. Pode parar de funcionar sem aviso a qualquer momento
(mudança de HTML, tipo de captcha, bloqueio por IP/volume). Como o rastreio de
webhook é periódico, uma falha pontual de captcha não é fatal — só tenta de
novo no próximo ciclo agendado.

## Rastreio via webhook (assinaturas)

Serviço próprio de monitoramento contínuo: você inscreve códigos, nós
verificamos periodicamente (usando o mesmo provedor de rastreio configurado
via `TRACKING_PROVIDER`, acima) e entregamos um POST assinado ao seu endpoint
sempre que os dados mudarem.

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

`POST /api/cron/run` (ou `GET`) roda uma rodada de verificações + reentregas
pendentes. Protegido por `Authorization: Bearer $CRON_SECRET`. Quem chama esse
endpoint periodicamente depende de onde está hospedado:
- **Vercel:** `vercel.json` já registra o cron a cada hora — no plano Hobby,
  Cron Jobs só disparam uma vez por dia; para a granularidade de 1-12h dos
  perfis, é necessário o plano Pro.
- **VPS via Coolify (ver seção abaixo):** o `docker-compose.yml` da raiz já
  inclui um serviço `cron` que chama esse endpoint a cada `CRON_INTERVAL_SECONDS`
  (padrão 15 min) — nenhuma configuração extra necessária.

### Erros
```json
{ "code": "invalid_argument", "message": "invalid tracking code: ABC123" }
```
| Código | HTTP | Quando |
|---|---|---|
| `unauthenticated` | 401 | `Authorization` ausente/inválido |
| `invalid_argument` | 400 | Código malformado, mais de 100 códigos, campos ausentes |
| `not_found` | 404 | Endpoint/perfil/inscrição inexistente |

## Deploy em VPS com Coolify

A stack toda (`api_correios` + Postgres + `correios-rastreamento`) sobe com um
único `docker-compose.yml` na raiz do repo — 4 serviços: `postgres`,
`migrate` (roda as migrations e sai), `app`, `correios-rastreamento` (só na
rede interna, não exposto), e `cron` (dispara `/api/cron/run` periodicamente,
substituindo o Vercel Cron). Testado localmente de ponta a ponta
(`docker compose up --build`) antes de documentar aqui.

### 1. Preparar as variáveis

Na VPS (ou direto no painel do Coolify, que injeta env vars no compose),
defina as variáveis do bloco final do [`.env.example`](.env.example)
("Only consumed by the root docker-compose.yml"), mais `CRON_SECRET`:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<gere uma senha forte>
POSTGRES_DB=api_correios
APP_PORT=3000
CRON_INTERVAL_SECONDS=900
CRON_SECRET=<gere um segredo forte>
COOKIE_SECURE=false   # até você configurar domínio + HTTPS no Coolify — ver nota abaixo
```

`TRACKING_PROVIDER`, `RASTREAMENTO_SERVICE_URL` e `DATABASE_URL` **não**
precisam ser setadas manualmente — o `docker-compose.yml` já monta esses
valores automaticamente (apontando pros serviços internos `correios-rastreamento`
e `postgres`).

### 2. Criar o recurso no Coolify

1. No painel do Coolify: **New Resource → Docker Compose**.
2. Aponte pro repositório Git deste projeto (branch `main`) — se o repo for
   privado, configure a credencial de acesso que o Coolify pedir.
3. Compose file: `docker-compose.yml` (raiz).
4. Cole as variáveis do passo 1 na seção de Environment Variables do recurso.
5. Deploy. O Coolify builda as 3 imagens (`app`, `migrate`,
   `correios-rastreamento` — `cron` usa a imagem `alpine` pronta) e sobe a
   stack. O build da imagem do `app` inclui `npm run build` (frontend) e a do
   `correios-rastreamento` inclui a instalação do PyTorch — a primeira build
   demora alguns minutos.

*(Os nomes exatos das telas podem variar um pouco entre versões do Coolify —
procure o equivalente a "Docker Compose" na hora de criar o recurso.)*

### 3. Acessando sem domínio ainda

Sem domínio configurado, acesse via `http://IP_DA_VPS:APP_PORT`. Login
funciona porque `COOKIE_SECURE=false` nessa fase — um cookie `secure` nunca é
enviado pelo navegador numa conexão HTTP pura, então essa variável existe
justamente pra não quebrar o login antes de haver HTTPS.

**Assim que configurar um domínio + certificado válido no Coolify:** troque
`COOKIE_SECURE` pra `true` (ou remova a variável, esse já é o default em
produção) e aponte o domínio pro serviço `app`. Webhooks assinados e o login
do painel devem sempre rodar atrás de HTTPS em produção de verdade — HTTP
puro é aceitável só nesta fase inicial de validação.

### 4. Criar o primeiro usuário do painel

As migrations rodam automaticamente (serviço `migrate`), mas o primeiro
usuário precisa ser criado manualmente, uma vez:

```bash
docker compose exec app npm run auth:create-user -- seu-email@empresa.com "sua-senha"
```

(Ou, se preferir, pelo terminal do próprio Coolify — o Coolify normalmente dá
acesso a um shell dentro do serviço `app`.)

### 5. Testando

```bash
curl http://IP_DA_VPS:APP_PORT/api/health
```

Depois, logue no painel (`/login`), teste um rastreio em `/panel/rastreios`,
crie uma chave de API em `/panel/api-keys` e um webhook de teste em
`/panel/webhooks`.

---

E-mail: verify@cronos.local
Senha: SenhaForte123
# Correios Batch Tracker API Documentation

Esta API atua como um agregador para a API Wonca, permitindo consultas de múltiplos códigos de rastreio em uma única chamada.

## Endpoint Principal

### `POST /api/track/batch`

Processa uma lista de códigos de rastreio dos Correios.

#### Request Body
```json
{
  "codes": ["YB754713088BR", "AA123456789BR"]
}
```
- `codes`: Array de strings (mínimo 1, máximo configurado via `MAX_CODES`, padrão 200).

#### Response Body (Sucesso)
```json
{
  "requested": 2,
  "succeeded": 1,
  "failed": 1,
  "results": [
    {
      "code": "YB754713088BR",
      "ok": true,
      "data": { "status": "Objeto entregue ao destinatário", "data": "20/02/2024" }
    },
    {
      "code": "AA123456789BR",
      "ok": false,
      "error": {
        "message": "Request failed with status code 404",
        "status": 404,
        "details": "Objeto não encontrado"
      }
    }
  ]
}
```

## Configuração (Variáveis de Ambiente)

As seguintes variáveis devem ser configuradas no painel de **Secrets** do AI Studio:

| Variável | Descrição | Padrão |
| :--- | :--- | :--- |
| `WONCA_URL` | URL base da API Wonca | `https://api.wonca.example/track` |
| `WONCA_AUTH` | Header de Autorização (ex: `Bearer TOKEN`) | `Bearer default_token` |
| `TIMEOUT_MS` | Timeout por requisição individual | `15000` |
| `MAX_CODES` | Limite de códigos por lote | `50` |
| `CONCURRENCY` | Número de requisições simultâneas | `3` |

## Como Testar via Terminal (cURL)

Substitua `http://localhost:3000` pela URL do seu app se estiver testando remotamente.

```bash
curl -X POST http://localhost:3000/api/track/batch \
     -H "Content-Type: application/json" \
     -d '{
       "codes": [
         "YB754713088BR",
         "AA123456789BR"
       ]
     }'
```

## Testes Automatizados

Para rodar os testes unitários e de integração:
```bash
npm test
```

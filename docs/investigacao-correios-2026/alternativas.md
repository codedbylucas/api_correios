# Alternativas — comparação (2026-11-02)

| # | Opção | Custo | Automático? | Autorizado? | Estado | Observações |
|---|---|---|---|---|---|---|
| 1 | **API oficial com credencial do CWS** (própria ou **subdelegada** por quem tem o contrato) | R$ 0 extra, se houver contrato (preço oficial não encontrado; relato informal diz que o rastreio não é cobrado) | Sim, 100% | Sim | Provedor `correios-api` pronto, rota corrigida para `/srorastro`; **falta credencial** | Chave vale 180 dias, sem renovação: gerar nova a cada semestre. Só devolve objetos do contrato. |
| 2 | **Coleta assistida** (`POST /api/track/import` + página local `npm run diagnostico:colagem`) | R$ 0 | Não: 1 pessoa por busca de até 20 códigos | Sim (a pessoa usa o site normalmente) | 41 testes com dados **simulados**, app real; aceita JSON (`resultado.php` e `rastroMulti.php`) e texto copiado (sem F12, aproximado); **falta validar com uma colagem real** | JSON é exato; texto é mais fácil para o atendente, mas perde segundos e depende do layout. Falta a tela de colar no CardSys (decisão sua). |
| 2b | **SIGEP WEB** (quem posta, se tiver contrato e cartão de postagem) | R$ 0 extra | Semi: exporta listas com status | Sim | Não testado | Fonte oficial para o contratante; só com contrato. |
| 3 | Pedir arquivo/relatório de rastreio a quem posta | R$ 0 | Semi (importação periódica) | Sim | Não iniciado | Depende do parceiro/contrato. |
| 4 | Agregadores pagos (17TRACK, TrackingMore, Ship24…) | Planos grátis de 10–50 envios/mês; API paga a partir de ~US$ 11/mês (fontes de concorrentes) | Sim | Sim | Cobertura dos Correios não confirmada | Com ~200 cartões/mês o grátis não cobre. Decisão de custo sua. |
| 5 | `rastro-correios-api.zeabur.app` | R$ 0 | Sim, em tese | Incerto (origem dos dados desconhecida) | **502** em todas as tentativas | Projeto pessoal, só README, sem garantia; mandaria códigos a um host desconhecido. Não recomendado. |
| 6 | Raspador/solver de Turnstile | — | — | **Não** | Não implementado | Contorna o controle anti-bot que os Correios mantêm de propósito. |

Recomendação: **1** (credencial/subdelegação) como solução definitiva; **2** como ponte até lá; **3** se o parceiro puder.

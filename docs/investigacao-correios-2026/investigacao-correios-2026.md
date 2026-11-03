# Investigação — rastreamento dos Correios (novembro de 2026)

Data: 2026-11-02. Sem credenciais, sem passar pelo Turnstile, só com códigos falsos (`AA123456785BR`).
Evidências reproduzíveis: `experimentos/diagnostico.mjs` → `experimentos/evidencias-2026-11-02.txt`.

## Resumo
O rastreio automático gratuito **não é possível por meio autorizado**. A página pública agora exige o Cloudflare Turnstile, e a API oficial só devolve objetos do contrato de quem a consulta. O que existe de custo zero é a **coleta assistida** (uma pessoa faz a consulta no site) e a **credencial do CWS** obtida pelo contrato de quem posta os cartões.

## 1. Fatos comprovados (com a evidência)

| Fato | Evidência |
|---|---|
| A página inicial tem `div.cf-turnstile`, `csrf_token` e um campo-isca `website` | `diagnostico.mjs` (HTML da home) |
| A busca aceita **até 20 códigos** por consulta; CPF/CNPJ pede login | texto do formulário na home |
| O envio é `fetch POST` para `resultado.php` (1 objeto) ou `rastroMulti.php` (vários), com o formulário inteiro (inclui o token do Turnstile) | `index.js` público, linhas 31-50 |
| O token é **renovado depois de cada consulta** (`renovarTurnstile()`), ou seja, 1 verificação por busca | `index.js` público |
| `GET resultado.php` devolve **405** | `diagnostico.mjs` |
| A resposta é JSON; no objeto único é o próprio objeto (`codObjeto`, `situacao`, `dtPrevista`, `eventos[]` com `descricao`, `dtHrCriado.date`, `unidade.tipo/nome/endereco.cidade/uf`); erro = `{erro:true, mensagem}` | `index.js`, `rastroUnico.js` públicos |
| O Securimage/CRNN não tem como resolver o Turnstile (não há imagem) | `correios.py` do serviço antigo + home atual |
| Comunicado dos Correios: a API Rastro ficou restrita aos objetos do contrato do remetente; site e app não mudaram para o usuário; objetivo declarado: reduzir uso indevido por sites e apps não autorizados | [comunicado](https://www.correios.com.br/central-de-informacoes/boletim-aos-clientes/correios-aprimoram-ciberseguranca-para-rastreamento-de-pacotes) |
| O contratante pode **subdelegar** o acesso a terceiros no CWS; a chave vale até 180 dias, sem renovação | [portal de desenvolvedores](https://www.correios.com.br/atendimento/developers) |
| `rastroMulti.php` tem formato DIFERENTE de `resultado.php`: `{transito:[linha], entregue:[linha]}`; linha com resultado = `{cod_objeto, descricao, cidade, uf, data_evento:{date}, objeto:{codObjeto, eventos[...]}}`; linha sem resultado = `{cod_objeto, mensagem_h}` (snake_case, não `codObjeto`) | `rastroMulti.js` público (templates `trsEmTransitoSemMsg`/`trsEntregue`/`trsEmTransitoComMsg`) |
| A página lista as APIs Rastro, Preço, Prazo, CEP, Pré-postagem…; "públicas" = qualquer login Meu Correios; "privadas" = contrato. Rastro: só objetos do contrato. Quem recebe uma chave subdelegada a valida no CWS → Credenciais | [portal de desenvolvedores](https://www.correios.com.br/atendimento/developers) |
| Gateway oficial: a rota é `/srorastro/v1/objetos...` (403 "Token inválido" = existe). `/rastro/v1/...` **não existe** (GTW-003). Token: `/token/v1/autentica[/cartaopostagem]` existe (exige Basic) | `diagnostico.mjs` |
| `rastro-correios-api.zeabur.app` respondeu **502** em 4 tentativas, com código falso | `evidencias-2026-11-02.txt` |

## 2. Hipóteses (não comprovadas)
- Os valores reais dos campos de `rastroMulti.php` (ver fato abaixo sobre o formato) não foram vistos; só dá para ver passando pelo Turnstile no navegador.
- O JSON da API oficial (`/srorastro`) provavelmente traz `objetos[].eventos[].dtHrCriado` em texto ISO. O conversor é tolerante, mas só uma credencial real confirma.
- A API do `zeabur.app` obtém os dados raspando o site ou usando credenciais de terceiros. A página não diz.

## 3. Inconclusivo
- Se o contrato dos reenvios de cartão é da Gazin ou de um terceiro (define se é credencial própria ou subdelegação).
- Se algum dos projetos do GitHub citados (`opastorello/correios-rastreamento`, `rastreie-bot`, `correios-api-toolkit`, `chipytux/correiosApi`) funciona hoje. Pelos READMEs: `rastreie-bot` e `correios-api-toolkit` usam a API oficial com token; `chipytux` dependia do Link&Track, descontinuado; `opastorello` descreve o captcha de imagem antigo e não mostra commits nem issues sobre a mudança. Nenhum foi executado.

## 4. Fluxo observado (atual × antigo)

```
ANTIGO                                      ATUAL
index.php  (sessão)                         index.php  (sessão + csrf_token + campo-isca)
   |                                           |
securimage_show.php  -> imagem                 widget Cloudflare Turnstile (navegador de pessoa)
   |   (CRNN lê o texto)                       |   token de 1 uso, renovado a cada busca
resultado.php?objeto&captcha  (GET)         POST resultado.php | rastroMulti.php
   |                                           |   (formulário + cf-turnstile-response)
JSON com eventos                            JSON com eventos  (mesma estrutura de campos)
```

A estrutura dos eventos **não mudou**: por isso o `formatTrackResponse` continua servindo, e a coleta assistida só precisa do JSON que a página recebe.

## 5. Decisões e limites
- Não foi implementada nenhuma forma de passar pelo Turnstile, resolvê-lo ou disfarçar automação; o site e os Correios tratam isso como uso indevido.
- Provedor da API oficial (`TRACKING_PROVIDER=correios-api`): pronto e testado com HTTP simulado; falta credencial para o teste real.
- Protótipo de coleta assistida: `POST /api/track/import` (ver `README.md`). Os testes usam JSON montado a partir dos nomes de campo do site, **não** uma resposta real.

## 6. Segunda rodada — importador da coleta assistida

### Validado com dados SIMULADOS (41 testes, `experimentos/evidencias-testes-2026-11-02.txt`)
Fixtures montadas a partir dos campos/templates do site (`tests/fixturesSite.ts`); **nada foi validado com resposta real**.
- App Express real (`src/server/app.ts`, agora extraído do `server.ts`) subido em porta local, com login real do modo `DEV_AUTH` do projeto (sessão em memória): 401 sem credencial; 200 para `resultado.php`, `rastroMulti.php` e texto copiado; 400 sem ecoar o conteúdo; limite de 2 MB só no `/import` e `/batch` intacto (413 >100 kb); health; nenhum log contém texto colado, nome ou código.
- Dois formatos tratados separadamente (e com o mesmo resultado quando descrevem o mesmo objeto): `resultado.php` e `rastroMulti.php`, inclusive linha só com resumo e linha "não encontrado" (HTML da mensagem removido).
- Vazio, só espaços, `{}`/`[]`, objeto inexistente, evento sem campos, datas inválidas (só inválidas = erro 422; mistura = evento sem data vai para o fim), JSON quebrado, código fora do padrão, excesso de objetos.
- Dados pessoais: só data, descrição, tipo de unidade, cidade e UF saem; nome e rua colocados de propósito na fixture não aparecem na saída.
- Mutação: voltar o limite para 100 kb e fazer o controller logar o texto derrubam os testes certos.
- Não coberto: autenticação por chave de API (exige Postgres, indisponível aqui), páginas visuais no navegador.

### Validado com dados REAIS
**Nada.** Falta uma colagem real (a consulta exige que uma pessoa passe pelo Turnstile).

### Importar o texto copiado da página, sem F12 (item 6)
- **Viável, com ressalvas.** Prova de conceito em `importarTextoCopiado.ts`: o texto simulado (gerado imitando os templates do site) rende os mesmos eventos do JSON — descrição, data até o minuto, cidade e UF.
- **Perde:** os segundos (o site mostra só hh:mm) e o tipo de unidade na maioria dos eventos.
- **Depende do layout** (descrição termina em ponto; data/hora no fim do bloco; código no cabeçalho ou no início da linha da lista). Se os Correios mudarem o HTML, quebra; o JSON continua sendo o caminho exato.
- Para atendentes é a melhor experiência (Ctrl+A, Ctrl+C), mas **só vale confiar depois de testar com uma página real**.

### Pesquisa adicional de soluções gratuitas e autorizadas (item 7)
Nenhuma fonte nova gratuita e autorizada de rastreio automático apareceu:
- Bibliotecas abertas (linkcorreios 2023, sro-correios 2022, correios-php, pycorreios): antigas, sem confirmação de funcionamento; as que usam a API oficial pedem a mesma credencial.
- SIGEP WEB (exige contrato e cartão de postagem) exporta listas de postagem com o status dos objetos: caminho oficial para quem tem contrato.
- Avisos por SMS/e-mail do próprio site dos Correios: relatos de 2015–2017, não confirmados hoje e sem uso por sistema.
- Agregadores (TrackingMore etc.): planos gratuitos pequenos, alertas por SMS pagos.

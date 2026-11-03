// Roda com: npx tsx --test tests/importEndpoint.integration.test.ts
// Sobe o app Express REAL (src/server/app.ts: parsers, cookie, sessao, rotas, validadores, controller) numa porta
// local e fala com ele por HTTP. Sem Postgres: usa o modo DEV_AUTH que o proprio projeto traz (sessao em memoria),
// com credenciais FALSAS definidas so aqui. NAO cobre a autenticacao por chave de API (essa exige banco).
// Dados SIMULADOS (tests/fixturesSite.ts): nada vai para os Correios.
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { respostaResultadoPhp, respostaRastroMultiPhp, objetoSite, textoPaginaUnica, MARCADOR_NOME } from './fixturesSite.js';

const EMAIL = 'teste@exemplo.invalid';
const SENHA = 'senha-falsa-so-para-teste-local';

let server: Server;
let base = '';
let cookie = '';

before(async () => {
  process.env.DEV_AUTH_EMAIL = EMAIL;
  process.env.DEV_AUTH_PASSWORD = SENHA;
  process.env.NODE_ENV = 'test';
  delete process.env.DATABASE_URL;
  const { createApp } = await import('../src/server/app.js');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: SENHA }) });
  assert.equal(login.status, 200, 'login do modo DEV_AUTH');
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /^cronos_session=/);
});
after(() => server?.close());

const importar = (body: unknown, comSessao = true, bruto = false) =>
  fetch(`${base}/api/track/import`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(comSessao ? { cookie } : {}) },
    body: bruto ? (body as string) : JSON.stringify(body),
  });

test('sem sessao nem chave de API: 401 e nada e processado', async () => {
  const r = await importar({ text: JSON.stringify(respostaResultadoPhp('AA000000001BR')) }, false);
  assert.equal(r.status, 401);
});

test('resultado.php: 200 com o formato da plataforma', async () => {
  const r = await importar({ text: JSON.stringify(respostaResultadoPhp('AA000000001BR')) });
  assert.equal(r.status, 200);
  const itens: any[] = await r.json();
  assert.equal(itens[0].code, 'AA000000001BR');
  assert.equal(itens[0].events[0].description, 'Objeto entregue ao destinatário');
  assert.equal(itens[0].lastUpdate, '2026-10-23 10:05:00.000000');
});

test('rastroMulti.php: 200 com 3 itens (em transito, nao encontrado, entregue)', async () => {
  const r = await importar({ text: JSON.stringify(respostaRastroMultiPhp()) });
  assert.equal(r.status, 200);
  const itens: any[] = await r.json();
  assert.deepEqual(itens.map((i) => [i.code, i.ok === false ? i.status : 'ok']), [['AA000000002BR', 'ok'], ['ZZ000000009BR', 404], ['AA000000001BR', 'ok']]);
});

test('texto copiado da pagina (sem F12): 200', async () => {
  const r = await importar({ text: textoPaginaUnica(objetoSite('AA123456785BR')) });
  assert.equal(r.status, 200);
  const itens: any[] = await r.json();
  assert.equal(itens[0].code, 'AA123456785BR');
  assert.equal(itens[0].events.length, 3);
});

test('entradas invalidas: 400 sem ecoar o que foi enviado', async () => {
  for (const corpo of [{}, { text: 12345678 }, { text: ' ' }, { text: '   \n  ' }, { text: '{"codObjeto":"AA000000001BR","eventos":[' + MARCADOR_NOME }, { text: '{}' }]) {
    const r = await importar(corpo);
    const txt = await r.text();
    assert.equal(r.status, 400, JSON.stringify(corpo).slice(0, 40));
    assert.ok(!txt.includes('12345678') && !txt.includes(MARCADOR_NOME) && !txt.includes('AA000000001BR'), 'a resposta de erro ecoou o conteudo enviado');
  }
  assert.equal((await importar('isto nao e json', true, true)).status, 400, 'corpo que nem e JSON');
});

test('limites: colagem grande (>100kb) passa em /import; >2mb leva 413; /batch continua com limite padrao', async () => {
  const muitos = Array.from({ length: 20 }, (_, i) => {
    const o = objetoSite(`AA${String(i).padStart(9, '0')}BR`);
    for (let k = 0; k < 40; k++) o.eventos.push({ ...o.eventos[2], descricao: `Evento intermediario numero ${k} com texto de preenchimento realista` });
    return o;
  });
  const texto = JSON.stringify(muitos);
  assert.ok(texto.length > 100_000 && texto.length < 2_000_000, `fixture com ${texto.length} bytes`);
  assert.equal((await importar({ text: texto })).status, 200);

  assert.equal((await importar({ text: 'x'.repeat(2_100_000) })).status, 413);
  const batch = await fetch(`${base}/api/track/batch`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ codes: ['x'.repeat(150_000)] }) });
  assert.equal(batch.status, 413);
});

test('/batch segue validando como antes (rota existente nao foi afetada)', async () => {
  const r = await fetch(`${base}/api/track/batch`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ codes: [] }) });
  assert.equal(r.status, 400);
});

test('privacidade: nenhuma saida de log contem o texto colado, nomes ou codigos', async () => {
  const capturado: string[] = [];
  const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    mock.method(console, m, (...args: unknown[]) => void capturado.push(args.map((a) => (a instanceof Error ? `${a.name}:${a.message}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '))),
  );
  try {
    await importar({ text: JSON.stringify(respostaResultadoPhp('AA000000001BR')) });
    await importar({ text: JSON.stringify(respostaRastroMultiPhp()) });
    await importar({ text: '{"codObjeto":"AA000000001BR","eventos":[' + MARCADOR_NOME });
    await importar({ text: textoPaginaUnica(objetoSite('AA123456785BR')) });
  } finally {
    espioes.forEach((e) => e.mock.restore());
  }
  const tudo = capturado.join('\n');
  assert.ok(!tudo.includes(MARCADOR_NOME), 'nome vazou para o log');
  assert.ok(!/AA\d{9}BR/.test(tudo), 'codigo de rastreio foi para o log');
});

test('health informa o provedor ativo', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).provider, (process.env.TRACKING_PROVIDER || 'crnn').toLowerCase());
});

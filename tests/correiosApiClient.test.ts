// Roda com: npx tsx --test tests/correiosApiClient.test.ts   (sem rede: o HTTP e simulado)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CorreiosApiClient, toLegacyDate, type HttpLike } from '../src/server/clients/correiosApiClient.js';
import { formatTrackResponse } from '../src/server/utils/trackResponseFormatter.js';

type Chamada = { metodo: 'get' | 'post'; url: string; data?: any; config?: any };

/** HTTP falso: responde pelo caminho e guarda o que foi chamado. */
function httpFalso(respostas: Record<string, Array<{ status: number; data: any }> | { status: number; data: any }>) {
  const chamadas: Chamada[] = [];
  const responder = (metodo: 'get' | 'post') => async (url: string, a?: any, b?: any) => {
    chamadas.push({ metodo, url, data: metodo === 'post' ? a : undefined, config: metodo === 'post' ? b : a });
    const alvo = respostas[url] ?? respostas[url.split('?')[0]];
    if (!alvo) throw new Error('sem resposta simulada para ' + url);
    return Array.isArray(alvo) ? (alvo.length > 1 ? alvo.shift()! : alvo[0]) : alvo;
  };
  return { http: { get: responder('get'), post: responder('post') } as HttpLike, chamadas };
}

const cfg = { baseUrl: 'https://api.exemplo', user: 'usuario', accessCode: 'codigo', timeoutMs: 1000, batchSize: 2 };
const TOKEN_OK = { status: 201, data: { token: 'tok-1', expiraEm: new Date(Date.now() + 3600_000).toISOString() } };
const objeto = (codObjeto: string, descricao = 'Objeto postado') => ({
  codObjeto,
  eventos: [
    { codigo: 'PO', descricao, dtHrCriado: '2026-10-20T14:30:00', unidade: { tipo: 'Agência dos Correios', endereco: { cidade: 'Paranavaí', uf: 'PR' } } },
    { codigo: 'RO', descricao: 'Objeto em trânsito', dtHrCriado: '2026-10-21T08:00:15', unidade: { tipo: 'Unidade de Tratamento', endereco: { cidade: 'Curitiba', uf: 'PR' } } },
  ],
});

test('exige usuario e codigo de acesso', () => {
  assert.throws(() => new CorreiosApiClient({ ...cfg, user: '' }, httpFalso({}).http), /CORREIOS_API_USER/);
});

test('toLegacyDate aceita ISO, "espaco" e {date}; lixo vira null', () => {
  assert.equal(toLegacyDate('2026-10-20T14:30:00'), '2026-10-20 14:30:00.000000');
  assert.equal(toLegacyDate('2026-10-20 14:30:00.000000'), '2026-10-20 14:30:00.000000');
  assert.equal(toLegacyDate({ date: '2026-10-20 14:30:00.000000' }), '2026-10-20 14:30:00.000000');
  assert.equal(toLegacyDate('ontem'), null);
  assert.equal(toLegacyDate(undefined), null);
});

test('track: autentica com Basic, consulta com Bearer e devolve no formato que a plataforma ja usa', async () => {
  const { http, chamadas } = httpFalso({
    '/token/v1/autentica': TOKEN_OK,
    '/srorastro/v1/objetos/AA123456785BR': { status: 200, data: { objetos: [objeto('AA123456785BR')] } },
  });
  const cliente = new CorreiosApiClient(cfg, http);
  const envelope = await cliente.track('AA123456785BR');

  assert.equal(chamadas[0].url, '/token/v1/autentica');
  assert.equal(chamadas[0].config.headers.Authorization, 'Basic ' + Buffer.from('usuario:codigo').toString('base64'));
  assert.equal(chamadas[1].config.headers.Authorization, 'Bearer tok-1');
  assert.deepEqual(chamadas[1].config.params, { resultado: 'T' });

  // E passa pelo formatador existente (o mesmo do raspador antigo) sem perder nada
  const formatado = formatTrackResponse(envelope);
  assert.equal(formatado.code, 'AA123456785BR');
  assert.equal(formatado.lastUpdate, '2026-10-21 08:00:15.000000');
  assert.equal(formatado.events[0].description, 'Objeto em trânsito');
  assert.equal(formatado.events[0].fromText, 'Unidade de Tratamento, Curitiba - PR');
});

test('com cartao de postagem usa o endpoint de cartao e manda o numero', async () => {
  const { http, chamadas } = httpFalso({
    '/token/v1/autentica/cartaopostagem': TOKEN_OK,
    '/srorastro/v1/objetos/AA123456785BR': { status: 200, data: { objetos: [objeto('AA123456785BR')] } },
  });
  await new CorreiosApiClient({ ...cfg, postageCard: '0067599079' }, http).track('AA123456785BR');
  assert.equal(chamadas[0].url, '/token/v1/autentica/cartaopostagem');
  assert.deepEqual(chamadas[0].data, { numero: '0067599079' });
});

test('o token e reaproveitado entre consultas', async () => {
  const { http, chamadas } = httpFalso({
    '/token/v1/autentica': TOKEN_OK,
    '/srorastro/v1/objetos/AA123456785BR': { status: 200, data: { objetos: [objeto('AA123456785BR')] } },
  });
  const cliente = new CorreiosApiClient(cfg, http);
  await cliente.track('AA123456785BR');
  await cliente.track('AA123456785BR');
  assert.equal(chamadas.filter((c) => c.url === '/token/v1/autentica').length, 1);
});

test('token recusado na consulta: renova uma vez e repete', async () => {
  const { http, chamadas } = httpFalso({
    '/token/v1/autentica': [
      { status: 201, data: { token: 'velho', expiraEm: new Date(Date.now() + 3600_000).toISOString() } },
      { status: 201, data: { token: 'novo', expiraEm: new Date(Date.now() + 3600_000).toISOString() } },
    ],
    '/srorastro/v1/objetos/AA123456785BR': [
      { status: 401, data: {} },
      { status: 200, data: { objetos: [objeto('AA123456785BR')] } },
    ],
  });
  const envelope = await new CorreiosApiClient(cfg, http).track('AA123456785BR');
  assert.ok(envelope.json);
  assert.equal(chamadas.filter((c) => c.url === '/token/v1/autentica').length, 2);
  assert.equal(chamadas.at(-1)!.config.headers.Authorization, 'Bearer novo');
});

test('credencial recusada vira 503 com orientacao (nao "objeto nao encontrado")', async () => {
  const { http } = httpFalso({ '/token/v1/autentica': { status: 401, data: { msgs: ['PO-001'] } } });
  await assert.rejects(new CorreiosApiClient(cfg, http).track('AA123456785BR'), (e: any) => {
    assert.equal(e.response.status, 503);
    assert.match(e.message, /autenticacao recusada/);
    return true;
  });
});

test('objeto sem eventos (mensagem da API) e erro 404, nao sucesso', async () => {
  const { http } = httpFalso({
    '/token/v1/autentica': TOKEN_OK,
    '/srorastro/v1/objetos/ZZ000000000BR': { status: 200, data: { objetos: [{ codObjeto: 'ZZ000000000BR', mensagem: 'SRO-020: Objeto não encontrado na base de dados dos Correios.' }] } },
  });
  await assert.rejects(new CorreiosApiClient(cfg, http).track('ZZ000000000BR'), (e: any) => {
    assert.equal(e.response.status, 404);
    assert.match(e.message, /não encontrado/);
    return true;
  });
});

test('trackMany: divide em lotes, mistura sucesso e falha, e codigo ausente vira erro', async () => {
  const { http, chamadas } = httpFalso({
    '/token/v1/autentica': TOKEN_OK,
    '/srorastro/v1/objetos': [
      { status: 200, data: { objetos: [objeto('AA000000001BR'), { codObjeto: 'AA000000002BR', mensagem: 'SRO-020: não encontrado' }] } },
      { status: 200, data: { objetos: [] } },
    ],
  });
  const mapa = await new CorreiosApiClient(cfg, http).trackMany(['AA000000001BR', 'AA000000002BR', 'AA000000003BR']);

  const consultas = chamadas.filter((c) => c.url === '/srorastro/v1/objetos');
  assert.equal(consultas.length, 2, 'batchSize 2 => 2 consultas para 3 codigos');
  assert.equal(consultas[0].config.params.codigosObjetos, 'AA000000001BR,AA000000002BR');

  assert.ok(!(mapa.get('AA000000001BR') instanceof Error));
  assert.ok(mapa.get('AA000000002BR') instanceof Error);
  assert.ok(mapa.get('AA000000003BR') instanceof Error);
});

test('trackMany: falha do lote inteiro (limite 429) marca todos os codigos do lote', async () => {
  const { http } = httpFalso({
    '/token/v1/autentica': TOKEN_OK,
    '/srorastro/v1/objetos': { status: 429, data: {} },
  });
  const mapa = await new CorreiosApiClient(cfg, http).trackMany(['AA000000001BR', 'AA000000002BR']);
  for (const code of ['AA000000001BR', 'AA000000002BR']) {
    const erro = mapa.get(code) as any;
    assert.ok(erro instanceof Error);
    assert.equal(erro.response.status, 429);
  }
});

// ---- integracao com o restante da plataforma ----
import { mock } from 'node:test';
import axios from 'axios';
import { TrackingService } from '../src/server/services/trackingService.js';
import { RastreamentoServiceClient } from '../src/server/clients/rastreamentoServiceClient.js';

test('TrackingService + API oficial: sucesso formatado e erro com o status certo para o consumidor', async () => {
  const { http } = httpFalso({
    '/token/v1/autentica': TOKEN_OK,
    '/srorastro/v1/objetos/AA123456785BR': { status: 200, data: { objetos: [objeto('AA123456785BR')] } },
    '/srorastro/v1/objetos/ZZ000000000BR': { status: 200, data: { objetos: [{ codObjeto: 'ZZ000000000BR', mensagem: 'SRO-020' }] } },
  });
  const servico = new TrackingService(new CorreiosApiClient(cfg, http), 1);

  const ok = await servico.trackBatch(['AA123456785BR']);
  assert.equal(ok.results[0].ok, true);
  assert.equal(ok.results[0].data.events.length, 2);
  assert.equal(ok.results[0].data.lastUpdate, '2026-10-21 08:00:15.000000');

  const naoAchou = await servico.trackBatch(['ZZ000000000BR']);
  assert.equal(naoAchou.results[0].ok, false);
  assert.equal(naoAchou.results[0].error?.status, 404);
});

test('cliente antigo: "Metodo nao permitido" (Turnstile) vira 503 com a orientacao, nao erro generico', async () => {
  const falso = mock.method(axios, 'post', async () => ({ data: { erro: true, mensagem: 'Método não permitido.' } }));
  try {
    const cliente = new RastreamentoServiceClient('http://servico', '', 1000);
    await assert.rejects(cliente.track('AA123456785BR'), (e: any) => {
      assert.equal(e.response.status, 503);
      assert.match(e.message, /Turnstile/);
      assert.match(e.message, /correios-api/);
      return true;
    });
    const mapa = await cliente.trackMany(['AA123456785BR']);
    // lote com mensagem do site tambem e reconhecido
    assert.ok(mapa.get('AA123456785BR') instanceof Error);
  } finally {
    falso.mock.restore();
  }

  // Outro erro do servico continua com a propria mensagem
  const outro = mock.method(axios, 'post', async () => ({ data: { erro: true, mensagem: 'Objeto não encontrado.' } }));
  try {
    await assert.rejects(new RastreamentoServiceClient('http://servico', '', 1000).track('AA123456785BR'), /Objeto não encontrado/);
  } finally {
    outro.mock.restore();
  }
});

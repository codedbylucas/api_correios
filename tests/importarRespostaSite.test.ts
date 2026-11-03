// Roda com: npx tsx --test tests/importarRespostaSite.test.ts
// DADOS SIMULADOS (ver tests/fixturesSite.ts): nenhum teste aqui usa resposta real dos Correios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importarRespostaDoSite, RespostaInvalidaError, MAX_OBJETOS } from '../src/server/utils/importarRespostaSite.js';
import { respostaResultadoPhp, respostaRastroMultiPhp, linhaMulti, objetoSite, evento, MARCADOR_NOME, MARCADOR_RUA } from './fixturesSite.js';

const importar = (v: unknown) => importarRespostaDoSite(typeof v === 'string' ? v : JSON.stringify(v)) as any[];
const rejeita = (texto: string, padrao: RegExp) =>
  assert.throws(() => importarRespostaDoSite(texto), (e: any) => e instanceof RespostaInvalidaError && padrao.test(e.message));

// ---------- resultado.php (1 objeto) ----------
test('resultado.php: formato da plataforma, mais recente primeiro, unidade e cidade/UF', () => {
  const [item] = importar(respostaResultadoPhp('aa123456785br'));
  assert.equal(item.code, 'AA123456785BR');
  assert.equal(item.carrier, 'CARRIER_CORREIOS');
  assert.equal(item.lastUpdate, '2026-10-23 10:05:00.000000');
  assert.equal(item.events.length, 3);
  assert.equal(item.events[0].description, 'Objeto entregue ao destinatário');
  assert.equal(item.events[0].fromText, 'Unidade de Distribuição, Paranavaí - PR');
  assert.equal(item.events[2].fromText, 'Agência dos Correios, Curitiba - PR');
});

// ---------- rastroMulti.php: formato DIFERENTE (linhas snake_case que embrulham o objeto) ----------
test('rastroMulti.php: le transito + entregue, usa o objeto completo da linha e marca o nao encontrado', () => {
  const itens = importar(respostaRastroMultiPhp());
  assert.deepEqual(itens.map((i) => i.code), ['AA000000002BR', 'ZZ000000009BR', 'AA000000001BR']);

  const emTransito = itens[0];
  assert.equal(emTransito.events.length, 2, 'em transito: sem o evento de entrega');
  assert.equal(emTransito.events[0].description, 'Objeto saiu para entrega ao destinatário');

  const naoAchou = itens[1];
  assert.equal(naoAchou.ok, false);
  assert.equal(naoAchou.status, 404);
  assert.equal(naoAchou.error, 'Objeto não encontrado na base de dados dos Correios.', 'HTML da mensagem do site e removido');

  assert.equal(itens[2].events[0].description, 'Objeto entregue ao destinatário');
});

test('rastroMulti.php: linha sem o objeto completo usa so o resumo (descricao + cidade/UF + data)', () => {
  const linha: any = linhaMulti('AA000000003BR', true);
  delete linha.objeto;
  const [item] = importar({ transito: [], entregue: [linha] });
  assert.equal(item.events.length, 1);
  assert.equal(item.events[0].description, 'Objeto entregue ao destinatário');
  assert.equal(item.events[0].city, 'Paranavaí');
  assert.equal(item.lastUpdate, '2026-10-23 10:05:00.000000');
});

test('os dois formatos dao os MESMOS eventos para o mesmo objeto', () => {
  const doUnico = importar(respostaResultadoPhp('AA000000001BR'))[0];
  const doMulti = importar({ transito: [], entregue: [linhaMulti('AA000000001BR', true)] })[0];
  assert.deepEqual(doMulti, doUnico);
});

test('lista simples e { objetos: [...] } tambem sao aceitos; data em texto ISO (API oficial) tambem', () => {
  assert.equal(importar([objetoSite('AA000000001BR')])[0].code, 'AA000000001BR');
  const iso = { codObjeto: 'AA000000003BR', eventos: [{ descricao: 'Objeto postado', dtHrCriado: '2026-10-20T14:30:00' }] };
  assert.equal(importar({ objetos: [iso] })[0].lastUpdate, '2026-10-20 14:30:00.000000');
});

test('varios objetos: repetidos viram um so', () => {
  const itens = importar({ transito: [linhaMulti('AA000000001BR', false), linhaMulti('AA000000001BR', false)], entregue: [] });
  assert.equal(itens.length, 1);
});

// ---------- vazio, inexistente, campos ausentes, datas invalidas, JSON quebrado ----------
test('colagem vazia, so espacos, {} , [] e listas vazias sao rejeitadas com mensagem clara', () => {
  rejeita('', /Nada foi colado/);
  rejeita('   \n  ', /Nada foi colado/);
  rejeita('{}', /Nenhum objeto/);
  rejeita('[]', /Nenhum objeto/);
  rejeita('{"transito":[],"entregue":[]}', /Nenhum objeto/);
  rejeita('{"foo":[1,2,3]}', /Nenhum objeto/);
});

test('JSON malformado: erro claro que NAO repete o conteudo colado', () => {
  const colado = '{"codObjeto":"AA000000001BR","eventos":[' + MARCADOR_NOME;
  assert.throws(() => importarRespostaDoSite(colado), (e: any) => {
    assert.ok(e instanceof RespostaInvalidaError);
    assert.match(e.message, /JSON valido/);
    assert.ok(!e.message.includes(MARCADOR_NOME) && !e.message.includes('AA000000001BR'));
    return true;
  });
});

test('o site devolveu erro ({erro:true}): mensagem do site, sem HTML', () => {
  rejeita('{"erro":true,"mensagem":"<p>Verificacao de seguranca falhou</p>"}', /Verificacao de seguranca falhou/);
});

test('objeto inexistente (so mensagem) e objeto sem eventos viram erro 404, nunca sucesso', () => {
  const itens = importar({ transito: [{ cod_objeto: 'AA000000004BR', mensagem_h: 'Objeto não encontrado' }], entregue: [] });
  assert.equal(itens[0].ok, false);
  assert.equal(itens[0].status, 404);
  const semEventos = importar({ codObjeto: 'AA000000005BR', eventos: [] })[0];
  assert.equal(semEventos.status, 404);
  assert.equal(importar({ codObjeto: 'AA000000006BR' })[0].status, 404, 'eventos ausente');
  assert.equal(importar({ codObjeto: 'AA000000007BR', eventos: 'quebrado' })[0].status, 404, 'eventos nao e lista');
});

test('campos ausentes: evento sem descricao/unidade/endereco/data nao derruba os outros', () => {
  const [item] = importar({
    codObjeto: 'AA000000008BR',
    eventos: [
      null,
      'texto solto',
      { descricao: 'Sem unidade', dtHrCriado: { date: '2026-10-22 09:00:00.000000' } },
      { descricao: 'Unidade sem endereco', dtHrCriado: { date: '2026-10-21 09:00:00.000000' }, unidade: { tipo: 'CDD' } },
      { dtHrCriado: { date: '2026-10-20 09:00:00.000000' } },
    ],
  });
  assert.equal(item.events.length, 3, 'null e texto solto sao descartados');
  assert.equal(item.events[0].description, 'Sem unidade');
  assert.equal(item.events[0].fromText, null);
  assert.equal(item.events[1].fromText, 'CDD');
  assert.equal(item.events[2].description, null);
});

test('datas invalidas: so-invalidas vira erro 422; mistura mantem o evento e ordena o sem data por ultimo', () => {
  const todas = importar({ codObjeto: 'AA000000009BR', eventos: [{ descricao: 'x', dtHrCriado: { date: 'ontem' } }, { descricao: 'y' }] })[0];
  assert.equal(todas.ok, false);
  assert.equal(todas.status, 422);

  const mistura = importar({
    codObjeto: 'AA000000009BR',
    eventos: [{ descricao: 'sem data', dtHrCriado: { date: '31/02/2026' } }, { descricao: 'com data', dtHrCriado: { date: '2026-10-22 09:00:00.000000' } }],
  })[0];
  assert.equal(mistura.events[0].description, 'com data');
  assert.equal(mistura.events[1].date, null);
  assert.equal(mistura.lastUpdate, '2026-10-22 09:00:00.000000');
});

test('codigo fora do padrao vira erro 400 do item; excesso de objetos e rejeitado', () => {
  const itens = importar({ transito: [{ cod_objeto: 'ABC', mensagem_h: 'x' }, linhaMulti('AA000000001BR', false)], entregue: [] });
  assert.equal(itens[0].status, 400);
  assert.equal(itens[1].code, 'AA000000001BR');

  const demais = Array.from({ length: MAX_OBJETOS + 1 }, (_, i) => objetoSite(`AA${String(i).padStart(9, '0')}BR`));
  rejeita(JSON.stringify(demais), /Objetos demais/);
});

// ---------- privacidade ----------
test('dados pessoais do site (nome, rua) NUNCA saem na resposta importada', () => {
  const saida = JSON.stringify([...importar(respostaResultadoPhp('AA000000001BR')), ...importar(respostaRastroMultiPhp())]);
  assert.ok(!saida.includes(MARCADOR_NOME), 'nome do destinatario vazou');
  assert.ok(!saida.includes(MARCADOR_RUA), 'endereco vazou');
  assert.ok(saida.includes('Paranavaí'), 'mas a cidade (necessaria) continua');
  assert.ok(evento('x', '2026-10-20 14:30:00.000000').destinatario.nome === MARCADOR_NOME, 'a fixture realmente carrega o marcador');
});

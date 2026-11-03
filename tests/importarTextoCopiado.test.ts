// Roda com: npx tsx --test tests/importarTextoCopiado.test.ts
// DADOS SIMULADOS: o texto e GERADO imitando os templates do site (tests/fixturesSite.ts), nao copiado de uma pagina real.
// Serve para ver se a abordagem "sem F12" e viavel; so uma colagem real confirma o layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importarRespostaDoSite, RespostaInvalidaError } from '../src/server/utils/importarRespostaSite.js';
import { objetoSite, linhaMulti, textoPaginaUnica, textoTabelaMulti, MARCADOR_NOME } from './fixturesSite.js';

const importar = (t: string) => importarRespostaDoSite(t) as any[];
const resumo = (i: any) => i.events.map((e: any) => [e.description, e.date?.slice(0, 16), e.city, e.uf]);

test('texto da pagina de 1 objeto: mesmos eventos do JSON (perde segundos e tipo de unidade)', () => {
  const objeto = objetoSite('AA123456785BR');
  const [doTexto] = importar(textoPaginaUnica(objeto));
  const [doJson] = importarRespostaDoSite(JSON.stringify(objeto)) as any[];

  assert.equal(doTexto.code, 'AA123456785BR');
  assert.deepEqual(resumo(doTexto), resumo(doJson), 'descricao, data/hora (ate o minuto), cidade e UF iguais');
  assert.equal(doTexto.events[0].unitType, null, 'texto copiado nao traz o tipo da unidade nos eventos comuns');
  assert.equal(doTexto.lastUpdate, '2026-10-23 10:05:00.000000');
});

test('texto da tabela de varios objetos: ultimo evento de cada codigo', () => {
  const itens = importar(textoTabelaMulti([linhaMulti('AA000000001BR', true), linhaMulti('AA000000002BR', false)]));
  assert.deepEqual(itens.map((i) => i.code), ['AA000000001BR', 'AA000000002BR']);
  assert.equal(itens[0].events[0].description, 'Objeto entregue ao destinatário');
  assert.equal(itens[1].events[0].description, 'Objeto saiu para entrega ao destinatário');
  assert.equal(itens[1].events[0].city, 'Paranavaí');
  assert.equal(itens[1].lastUpdate, '2026-10-23 08:10:00.000000');
});

test('pagina de um objeto copiada duas vezes nao duplica eventos', () => {
  const t = textoPaginaUnica(objetoSite('AA123456785BR'));
  assert.equal(importar(t + '\n' + t)[0].events.length, 3);
});

test('o codigo pode vir sem espacos ou espacado ("AA 123 456 785 BR")', () => {
  const t = textoPaginaUnica(objetoSite('AA123456785BR'));
  assert.equal(importar(t)[0].code, 'AA123456785BR');
  assert.equal(importar(t.replace('AA 123 456 785 BR', 'AA123456785BR'))[0].code, 'AA123456785BR');
});

test('texto sem eventos, sem codigo, sem hora ou com data impossivel e rejeitado sem ecoar o conteudo', () => {
  for (const t of [
    'Rastreamento\nNenhum resultado',
    `Objeto entregue ao destinatário.\nParanavaí - PR\n23/10/2026 10:05\n${MARCADOR_NOME}`, // sem codigo
    'AA123456785BR\nObjeto entregue.\nParanavaí - PR\n23/10/2026', // sem hora
    'AA123456785BR\nObjeto entregue.\nParanavaí - PR\n31/02/2026 10:05', // data impossivel
  ]) {
    assert.throws(() => importar(t), (e: any) => {
      assert.ok(e instanceof RespostaInvalidaError);
      assert.ok(!e.message.includes(MARCADOR_NOME) && !e.message.includes('AA123456785BR'));
      return true;
    });
  }
});

test('JSON continua tendo prioridade: so cai no texto quando a colagem nao comeca com { ou [', () => {
  assert.throws(() => importar('{ isto nao e json AA123456785BR'), /JSON valido/);
});

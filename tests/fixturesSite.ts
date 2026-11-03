// Fixtures SIMULADAS: montadas a partir dos nomes de campo e dos templates lidos nos scripts publicos do site
// (index.js / rastroUnico.js / rastroMulti.js). NAO sao respostas reais capturadas dos Correios.
// Os campos MARCADOR_* simulam dados pessoais que o site possa mandar e que NUNCA podem sair do importador.
export const MARCADOR_NOME = 'FULANO MARCADOR SIGILO';
export const MARCADOR_RUA = 'Rua Marcador Sigilo 999';

export const evento = (descricao: string, date: string, tipo = 'Unidade de Distribuição', cidade = 'Paranavaí', uf = 'PR') => ({
  codigo: 'BDE',
  descricao,
  descricaoWeb: 'EM_TRANSITO',
  rota: 'NORMAL',
  dtHrCriado: { date, timezone_type: 3, timezone: 'America/Sao_Paulo' },
  unidade: { tipo, nome: tipo, endereco: { cidade, uf, logradouro: null, bairro: MARCADOR_RUA } },
  destinatario: { nome: MARCADOR_NOME },
});

/** Eventos do mais recente para o mais antigo, como o site lista. */
export const objetoSite = (codObjeto: string, entregue = true) => ({
  codObjeto,
  situacao: entregue ? 'E' : 'T',
  tipoPostal: { categoria: 'CARTA REGISTRADA' },
  eventos: [
    ...(entregue ? [evento('Objeto entregue ao destinatário', '2026-10-23 10:05:00.000000')] : []),
    evento('Objeto saiu para entrega ao destinatário', '2026-10-23 08:10:00.000000', 'Unidade de Distribuição', 'Paranavaí', 'PR'),
    evento('Objeto postado', '2026-10-20 14:30:00.000000', 'Agência dos Correios', 'Curitiba', 'PR'),
  ],
});

/** resultado.php: o proprio objeto. */
export const respostaResultadoPhp = (codObjeto: string) => objetoSite(codObjeto);

/** rastroMulti.php: { transito:[linha], entregue:[linha] } com linhas em snake_case que embrulham o objeto. */
export const linhaMulti = (codObjeto: string, entregue: boolean) => {
  const objeto = objetoSite(codObjeto, entregue);
  const topo = objeto.eventos[0];
  return {
    cod_objeto: codObjeto,
    cod_objeto_: codObjeto,
    descricao: topo.descricao,
    cidade: topo.unidade.endereco.cidade,
    uf: topo.unidade.endereco.uf,
    data_evento: topo.dtHrCriado,
    data_prevista: '',
    botoes: [],
    objeto,
  };
};
export const linhaMultiNaoEncontrada = (codObjeto: string) => ({
  cod_objeto: codObjeto,
  cod_objeto_: codObjeto,
  mensagem_h: '<b>Objeto não encontrado</b> na base de dados dos Correios.',
});
export const respostaRastroMultiPhp = () => ({
  transito: [linhaMulti('AA000000002BR', false), linhaMultiNaoEncontrada('ZZ000000009BR')],
  entregue: [linhaMulti('AA000000001BR', true)],
});

// ---- texto como a pagina renderiza (templates de rastroUnico.js / rastroMulti.js), para o teste "sem F12" ----
const dh = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)} ${date.slice(11, 16)}`;

/** Pagina de 1 objeto: cabecalho + por evento: "<descricao>." / "Cidade - UF" / "dd/mm/aaaa hh:mm". */
export function textoPaginaUnica(objeto: ReturnType<typeof objetoSite>): string {
  const c = objeto.codObjeto;
  const cabecalho = [`${c.slice(0, 2)} ${c.slice(2, 5)} ${c.slice(5, 8)} ${c.slice(8, 11)} ${c.slice(11)}`, objeto.tipoPostal.categoria, 'Previsão de Entrega: 25/10/2026'];
  const eventos = objeto.eventos.flatMap((e) => [`${e.descricao}. `, `${e.unidade.endereco.cidade} - ${e.unidade.endereco.uf}`, dh(e.dtHrCriado.date)]);
  return [...cabecalho, ...eventos].join('\n');
}

/** Tabela de varios: por linha, celulas separadas por TAB: codigo | descricao, cidade/UF, data-hora | prazo. */
export function textoTabelaMulti(linhas: Array<ReturnType<typeof linhaMulti>>): string {
  return ['Objeto\tStatus\tPrevisão de entrega', ...linhas.map((l) => `${l.cod_objeto}\t${l.descricao}\n${l.cidade}/${l.uf}\n${dh(l.data_evento.date)}\t23/10/2026`)].join('\n');
}

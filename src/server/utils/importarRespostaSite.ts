import { formatTrackResponse } from './trackResponseFormatter.js';
import { toLegacyDate } from '../clients/correiosApiClient.js';
import { importarTextoCopiado } from './importarTextoCopiado.js';
import { RespostaInvalidaError, type ItemImportado } from './importarTipos.js';

/**
 * Coleta ASSISTIDA: uma pessoa faz a consulta no site oficial dos Correios (passando ela mesma pela
 * verificacao de seguranca) e cola aqui o resultado. Nada aqui fala com os Correios nem toca no desafio.
 *
 * Aceita dois tipos de colagem:
 *  1. JSON da chamada do site (aba Rede do F12) — exato. Os DOIS formatos sao diferentes
 *     (campos conferidos nos scripts publicos index.js / rastroUnico.js / rastroMulti.js):
 *       resultado.php  (1 objeto)  -> { codObjeto, eventos:[{descricao, dtHrCriado:{date}, unidade:{...}}] }
 *       rastroMulti.php (varios)   -> { transito:[LINHA], entregue:[LINHA] }
 *         LINHA com resultado -> { cod_objeto, descricao, cidade, uf, data_evento:{date}, objeto:{codObjeto, eventos:[...]} }
 *         LINHA sem resultado -> { cod_objeto, mensagem_h }
 *  2. Texto copiado da pagina (Ctrl+A, Ctrl+C) — aproximado, ver importarTextoCopiado.ts.
 *
 * Privacidade: so saem data, descricao, tipo de unidade, cidade e UF (formatTrackResponse). Nome, rua e
 * documento que o site mande ficam de fora, e NADA do texto colado e registrado em log nem devolvido em erro.
 *
 * shortcut: o formato real nao foi visto (so da para ver passando pelo Turnstile); validar com colagem real.
 */
export { RespostaInvalidaError, type ItemImportado };

export const MAX_OBJETOS = parseInt(process.env.MAX_CODES || '200', 10);
const CODIGO = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

type Candidato = { code: string; objeto?: any; resumo?: any; mensagem?: string };

const limpaCodigo = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toUpperCase().slice(0, 30);
/** Texto vindo do site: sem HTML e curto (nunca ecoa o que a pessoa colou). */
const semTags = (v: unknown) => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
const erro = (code: string, error: string, status: number): ItemImportado => ({ code, ok: false, error, status });

function candidatos(json: any): Candidato[] {
  const achados: Candidato[] = [];

  // rastroMulti.php: { transito: [...], entregue: [...] } com linhas em snake_case
  if (json && !Array.isArray(json) && (Array.isArray(json.transito) || Array.isArray(json.entregue))) {
    for (const linha of [...(json.transito ?? []), ...(json.entregue ?? [])]) {
      const code = limpaCodigo(linha?.cod_objeto ?? linha?.cod_objeto_ ?? linha?.objeto?.codObjeto);
      if (!code) continue;
      const mensagem = linha?.mensagem_h ?? linha?.mensagem;
      achados.push(mensagem ? { code, mensagem: semTags(mensagem) } : { code, objeto: linha?.objeto, resumo: linha });
    }
    return achados;
  }

  // resultado.php (objeto unico), lista de objetos ou { objetos: [...] }
  const lista = Array.isArray(json) ? json : Array.isArray(json?.objetos) ? json.objetos : [json];
  for (const o of lista) {
    if (o && typeof o.codObjeto === 'string') achados.push({ code: limpaCodigo(o.codObjeto), objeto: o, resumo: o });
  }
  return achados;
}

/** Eventos como o formatador espera; item que nao e objeto sai; data invalida vira null (nunca inventa). */
function normalizarEventos(eventos: unknown[]): any[] {
  return eventos
    .filter((e): e is Record<string, any> => !!e && typeof e === 'object')
    .map((e) => {
      const bruto = e.dtHrCriado;
      const date = typeof bruto === 'string' ? toLegacyDate(bruto) : toLegacyDate(bruto?.date);
      return { ...e, dtHrCriado: { date } };
    });
}

function converter(c: Candidato): ItemImportado {
  if (!CODIGO.test(c.code)) return erro(c.code.slice(0, 20), 'Codigo de objeto fora do padrao', 400);
  if (c.mensagem) return erro(c.code, c.mensagem, 404);

  let eventos = Array.isArray(c.objeto?.eventos) ? normalizarEventos(c.objeto.eventos) : [];
  if (!eventos.length) {
    // Linha da lista sem o objeto completo: usa so o ultimo evento resumido (descricao + cidade/UF + data)
    const date = toLegacyDate(c.resumo?.data_evento?.date);
    if (c.resumo?.descricao && date) {
      eventos = [{ descricao: semTags(c.resumo.descricao), dtHrCriado: { date }, unidade: { endereco: { cidade: semTags(c.resumo.cidade) || null, uf: semTags(c.resumo.uf) || null } } }];
    } else {
      return erro(c.code, 'Sem eventos na resposta colada (consulte o objeto individualmente)', 404);
    }
  }
  if (eventos.every((e) => !e.dtHrCriado.date)) return erro(c.code, 'Nenhum evento tem data valida na resposta colada', 422);

  return formatTrackResponse({ carrier: 'CARRIER_CORREIOS', json: { codObjeto: c.code, eventos } }) as ItemImportado;
}

export function importarRespostaDoSite(texto: string): ItemImportado[] {
  const t = typeof texto === 'string' ? texto.trim() : '';
  if (!t) throw new RespostaInvalidaError('Nada foi colado.');

  if (!/^[[{]/.test(t)) return importarTextoCopiado(t); // nao e JSON: tenta o texto copiado da pagina

  let json: any;
  try {
    json = JSON.parse(t);
  } catch {
    throw new RespostaInvalidaError('O texto colado nao e um JSON valido. Copie a "Resposta" inteira da chamada resultado.php ou rastroMulti.php.');
  }
  if (json && !Array.isArray(json) && json.erro === true) {
    throw new RespostaInvalidaError(`O site dos Correios devolveu erro: ${semTags(json.mensagem) || 'sem mensagem'}`);
  }

  const lista = candidatos(json);
  if (!lista.length) throw new RespostaInvalidaError('Nenhum objeto encontrado no texto colado.');
  if (lista.length > MAX_OBJETOS) throw new RespostaInvalidaError(`Objetos demais na colagem (maximo ${MAX_OBJETOS}).`);

  const vistos = new Set<string>();
  return lista.filter((c) => !vistos.has(c.code) && vistos.add(c.code)).map(converter);
}

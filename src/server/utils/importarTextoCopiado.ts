import { formatTrackResponse } from './trackResponseFormatter.js';
import { RespostaInvalidaError, type ItemImportado } from './importarTipos.js';

/**
 * Importa o TEXTO copiado da pagina de resultado (Ctrl+A, Ctrl+C), sem precisar do F12.
 * Aproximado de proposito: segue o layout que o proprio site monta (rastroUnico.js / rastroMulti.js):
 *   evento (pagina de 1 objeto):  "<descricao>."  /  linhas de local  /  detalhes  /  "dd/mm/aaaa hh:mm"
 *   linha da lista (varios):      "<codigo>"  /  "<descricao>"  /  "<Cidade>/<UF>"  /  "dd/mm/aaaa hh:mm"
 * Perde os segundos (o site so mostra hh:mm) e depende do layout; o JSON continua sendo a fonte exata.
 *
 * shortcut: layout conferido so no codigo do site, nunca num texto real copiado; validar e ajustar com um.
 */
const CODIGO_NA_LINHA = /\b([A-Z]{2})\s?(\d{3})\s?(\d{3})\s?(\d{3})\s?([A-Z]{2})\b/;
const DATA_HORA = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/;
const SO_DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const LOCAL_TIPO = /^(?:de |Pela |Pelo )?([^,]+),\s*(.+?)\s*[-/]\s*([A-Z]{2})$/;
const LOCAL_SIMPLES = /^(.+?)\s*[-/]\s*([A-Z]{2})$/;

function paraDataLegada(m: RegExpMatchArray): string | null {
  const [, dd, mm, aaaa, hh, mi] = m;
  const d = new Date(Date.UTC(+aaaa, +mm - 1, +dd, +hh, +mi));
  const ok = d.getUTCFullYear() === +aaaa && d.getUTCMonth() === +mm - 1 && d.getUTCDate() === +dd && +hh < 24 && +mi < 60;
  return ok ? `${aaaa}-${mm}-${dd} ${hh}:${mi}:00.000000` : null;
}

export function importarTextoCopiado(texto: string): ItemImportado[] {
  const linhas = texto.replace(/\t/g, '\n').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const porCodigo = new Map<string, any[]>();
  let codigo: string | null = null;
  let buf: string[] = [];

  for (const linha of linhas) {
    if (SO_DATA.test(linha)) continue; // previsao/prazo sem hora: nao e evento

    const dh = linha.match(DATA_HORA);
    if (!dh) {
      const c = linha.length <= 40 ? linha.match(CODIGO_NA_LINHA) : null;
      if (c) {
        codigo = c.slice(1).join('');
        buf = [];
      } else {
        buf.push(linha);
      }
      continue;
    }

    const date = paraDataLegada(dh);
    const bloco = buf;
    buf = [];
    if (!codigo || !date) continue;

    // descricao: a 1a linha que termina em "." (evento da pagina; ignora o cabecalho) ou, sem ela, a 1a linha (linha da lista)
    const ponto = bloco.findIndex((l) => /\.\s*$/.test(l) || /\.\s*O prazo limite/.test(l));
    const i = ponto >= 0 ? ponto : 0;
    if (!bloco[i]) continue;
    const descricao = bloco[i].replace(/\.\s*(O prazo limite.*)?$/, '').trim();
    const local = bloco[i + 1] ?? '';
    const lt = local.match(LOCAL_TIPO);
    const ls = lt ? null : local.match(LOCAL_SIMPLES);
    const unidade = lt
      ? { tipo: lt[1].trim(), endereco: { cidade: lt[2], uf: lt[3] } }
      : ls
        ? { endereco: { cidade: ls[1], uf: ls[2] } }
        : undefined;

    const eventos = porCodigo.get(codigo) ?? [];
    if (!eventos.some((e) => e.descricao === descricao && e.dtHrCriado.date === date)) {
      eventos.push({ descricao, dtHrCriado: { date }, ...(unidade ? { unidade } : {}) });
    }
    porCodigo.set(codigo, eventos);
  }

  if (!porCodigo.size) {
    throw new RespostaInvalidaError('Nao consegui ler eventos nesse texto. Copie a pagina de resultado inteira (Ctrl+A, Ctrl+C) ou use o JSON da aba Rede.');
  }
  return [...porCodigo].map(([code, eventos]) => formatTrackResponse({ carrier: 'CARRIER_CORREIOS', json: { codObjeto: code, eventos } }) as ItemImportado);
}

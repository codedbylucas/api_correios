import axios from 'axios';
import type { TrackingClient } from '../services/trackingService.js';

/**
 * Provedor de rastreio pela API OFICIAL dos Correios (CWS):
 *   POST {base}/token/v1/autentica[/cartaopostagem]   (Basic usuario:codigoDeAcesso) -> { token, expiraEm }
 *   GET  {base}/srorastro/v1/objetos/{codigo}?resultado=T
 *   GET  {base}/srorastro/v1/objetos?codigosObjetos=A,B&resultado=T
 *
 * Substitui o raspador do site (captcha de imagem, hoje trocado por Cloudflare Turnstile).
 * Atencao: a consulta so devolve objetos vinculados ao contrato das credenciais usadas.
 *
 * O formato da resposta nao esta no OpenAPI publico; a conversao abaixo e tolerante e leva tudo para o
 * mesmo formato que o site devolvia (codObjeto, eventos[].dtHrCriado.date, descricao, unidade...), que e
 * o que o resto da plataforma e os consumidores (webhook) ja esperam.
 * shortcut: validar com credenciais reais e uma resposta de verdade antes de confiar; ajustar toLegacyEvent se difere.
 */

export interface CorreiosApiConfig {
  baseUrl: string;
  user: string;
  accessCode: string;
  postageCard?: string;
  timeoutMs: number;
  batchSize: number;
}

/** So o que o cliente usa do axios (facilita testar sem rede). */
export interface HttpLike {
  get(url: string, config?: any): Promise<{ status: number; data: any }>;
  post(url: string, data?: any, config?: any): Promise<{ status: number; data: any }>;
}

type Envelope = { carrier?: string; json?: string };

const MARGEM_DO_TOKEN_MS = 60_000;
const VALIDADE_PADRAO_MS = 50 * 60_000;

/** Erro no formato que o TrackingService le (error.response.status / data). */
function erroApi(mensagem: string, status: number, data?: unknown): Error {
  const erro = new Error(mensagem) as Error & { response: { status: number; data?: unknown } };
  erro.response = { status, data };
  return erro;
}

/** "2023-05-01T10:00:00" | "2023-05-01 10:00:00.000000" | {date} -> "2023-05-01 10:00:00.000000" (horario local, sem fuso). */
export function toLegacyDate(valor: unknown): string | null {
  const bruto = typeof valor === 'object' && valor !== null ? (valor as any).date : valor;
  if (typeof bruto !== 'string') return null;
  const m = bruto.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}.000000` : null;
}

function toLegacyEvent(e: any) {
  return {
    ...e,
    dtHrCriado: { date: toLegacyDate(e?.dtHrCriado) },
    descricao: e?.descricao ?? null,
    unidade: {
      tipo: e?.unidade?.tipo ?? null,
      endereco: {
        cidade: e?.unidade?.endereco?.cidade ?? null,
        uf: e?.unidade?.endereco?.uf ?? null,
      },
    },
  };
}

export class CorreiosApiClient implements TrackingClient {
  private token: string | null = null;
  private tokenValidoAte = 0;

  constructor(private config: CorreiosApiConfig, private http: HttpLike = CorreiosApiClient.criarHttp(config)) {
    if (!config.user || !config.accessCode) {
      throw new Error('API dos Correios: defina CORREIOS_API_USER e CORREIOS_API_ACCESS_CODE.');
    }
  }

  private static criarHttp(config: CorreiosApiConfig): HttpLike {
    // validateStatus aberto: os status HTTP sao tratados aqui, nao como excecao do axios
    return axios.create({ baseURL: config.baseUrl, timeout: config.timeoutMs, validateStatus: () => true }) as unknown as HttpLike;
  }

  private async obterToken(forcar = false): Promise<string> {
    if (!forcar && this.token && Date.now() < this.tokenValidoAte) return this.token;

    const { user, accessCode, postageCard } = this.config;
    const basic = Buffer.from(`${user}:${accessCode}`).toString('base64');
    const caminho = postageCard ? '/token/v1/autentica/cartaopostagem' : '/token/v1/autentica';
    const res = await this.http.post(caminho, postageCard ? { numero: postageCard } : {}, {
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
    });

    if ((res.status !== 200 && res.status !== 201) || !res.data?.token) {
      // Credencial recusada e configuracao do nosso lado: 503 (o consumidor nao deve tratar como "objeto nao encontrado")
      throw erroApi(`API dos Correios: autenticacao recusada (HTTP ${res.status}). Confira usuario, codigo de acesso e cartao de postagem.`, 503, res.data);
    }

    const expira = Date.parse(res.data.expiraEm);
    this.token = res.data.token as string;
    this.tokenValidoAte = (Number.isFinite(expira) ? expira : Date.now() + VALIDADE_PADRAO_MS) - MARGEM_DO_TOKEN_MS;
    return this.token;
  }

  /** GET autenticado; se o token for recusado, renova uma vez e repete. */
  private async consultar(caminho: string, params: Record<string, string>): Promise<any> {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const token = await this.obterToken(tentativa > 0);
      const res = await this.http.get(caminho, { params, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      if ((res.status === 401 || res.status === 403) && tentativa === 0) continue;
      if (res.status === 429) throw erroApi('API dos Correios: limite de consultas atingido (HTTP 429). Tente de novo mais tarde.', 429, res.data);
      if (res.status < 200 || res.status >= 300) {
        throw erroApi(`API dos Correios: erro HTTP ${res.status}.`, res.status >= 500 ? 502 : res.status, res.data);
      }
      return res.data;
    }
    throw erroApi('API dos Correios: token recusado mesmo apos renovar.', 503);
  }

  /** Objetos da resposta (varios, um so ou ja o proprio objeto). */
  private static listarObjetos(data: any): any[] {
    if (Array.isArray(data?.objetos)) return data.objetos;
    if (data && typeof data === 'object' && data.codObjeto) return [data];
    return [];
  }

  private static paraEnvelope(objeto: any): Envelope | Error {
    const eventos = Array.isArray(objeto?.eventos) ? objeto.eventos : [];
    if (eventos.length === 0) {
      // Sem eventos: a API manda "mensagem" (objeto invalido / nao encontrado). Nao e sucesso.
      return erroApi(objeto?.mensagem || 'Objeto nao encontrado na base de dados dos Correios.', 404, objeto);
    }
    return { carrier: 'CARRIER_CORREIOS', json: JSON.stringify({ ...objeto, eventos: eventos.map(toLegacyEvent) }) };
  }

  async track(code: string): Promise<Envelope> {
    const data = await this.consultar(`/srorastro/v1/objetos/${encodeURIComponent(code)}`, { resultado: 'T' });
    const objeto = CorreiosApiClient.listarObjetos(data).find((o) => o?.codObjeto === code) ?? CorreiosApiClient.listarObjetos(data)[0];
    const resultado = objeto ? CorreiosApiClient.paraEnvelope(objeto) : erroApi('Objeto nao retornado pela API dos Correios.', 404, data);
    if (resultado instanceof Error) throw resultado;
    return resultado;
  }

  async trackMany(codes: string[]): Promise<Map<string, Envelope | Error>> {
    const saida = new Map<string, Envelope | Error>();
    const tamanho = Math.max(1, this.config.batchSize);

    for (let i = 0; i < codes.length; i += tamanho) {
      const lote = codes.slice(i, i + tamanho);
      try {
        const data = await this.consultar('/srorastro/v1/objetos', { codigosObjetos: lote.join(','), resultado: 'T' });
        const porCodigo = new Map(CorreiosApiClient.listarObjetos(data).map((o) => [o?.codObjeto as string, o]));
        for (const code of lote) {
          const objeto = porCodigo.get(code);
          saida.set(code, objeto ? CorreiosApiClient.paraEnvelope(objeto) : erroApi('Objeto nao retornado pela API dos Correios.', 404));
        }
      } catch (erro: any) {
        for (const code of lote) saida.set(code, erro); // falha do lote inteiro (auth, limite, rede)
      }
    }
    return saida;
  }
}

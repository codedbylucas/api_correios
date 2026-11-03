import axios from 'axios';
import type { TrackingClient } from '../services/trackingService.js';

const MULTI_CHUNK_SIZE = 20;

// O site dos Correios trocou o captcha de imagem pelo Cloudflare Turnstile e passou a exigir POST: o raspador
// recebe "Metodo nao permitido". Isso nao e problema do objeto: e o provedor que acabou. Sinaliza 503 e o que fazer.
const SINTOMA_TURNSTILE = /m[eé]todo n[aã]o permitido|turnstile/i;

function erroDoServico(mensagem: string | undefined): Error {
  if (mensagem && SINTOMA_TURNSTILE.test(mensagem)) {
    const erro = new Error('Provedor de rastreio indisponivel: o site dos Correios passou a exigir verificacao Cloudflare Turnstile. Use TRACKING_PROVIDER=correios-api (API oficial).') as Error & { response: { status: number } };
    erro.response = { status: 503 };
    return erro;
  }
  return new Error(mensagem || 'Tracking error');
}
// /rastreamento/multiplos resolve 1 captcha e raspa ate 20 objetos por chamada,
// entao precisa de bem mais tempo do que uma consulta de objeto unico.
const MIN_MULTI_TIMEOUT_MS = 45000;

export class RastreamentoServiceClient implements TrackingClient {
  constructor(
    private baseUrl: string,
    private token?: string,
    private timeoutMs = 30000
  ) {}

  private authHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : undefined;
  }

  async track(code: string): Promise<{ carrier: string; json: string }> {
    const res = await axios.post(
      `${this.baseUrl}/rastreamento/objeto`,
      { codigo: code },
      { timeout: this.timeoutMs, headers: this.authHeaders() }
    );
    const data = res.data;
    if (data?.erro) {
      throw erroDoServico(data.mensagem);
    }
    return { carrier: 'CARRIER_CORREIOS', json: JSON.stringify(data) };
  }

  async trackMany(codes: string[]): Promise<Map<string, { carrier?: string; json?: string } | Error>> {
    const out = new Map<string, { carrier?: string; json?: string } | Error>();

    for (let i = 0; i < codes.length; i += MULTI_CHUNK_SIZE) {
      const chunk = codes.slice(i, i + MULTI_CHUNK_SIZE);

      try {
        const res = await axios.post(
          `${this.baseUrl}/rastreamento/multiplos`,
          { codigos: chunk },
          { timeout: Math.max(this.timeoutMs, MIN_MULTI_TIMEOUT_MS), headers: this.authHeaders() }
        );
        const data = res.data as Record<string, any>;

        for (const code of chunk) {
          const objeto = data[code];
          if (!objeto) {
            out.set(code, new Error('Code missing from batch response'));
          } else if (objeto.erro) {
            out.set(code, erroDoServico(objeto.mensagem));
          } else {
            out.set(code, { carrier: 'CARRIER_CORREIOS', json: JSON.stringify(objeto) });
          }
        }
      } catch (error: any) {
        for (const code of chunk) out.set(code, error);
      }
    }

    return out;
  }
}

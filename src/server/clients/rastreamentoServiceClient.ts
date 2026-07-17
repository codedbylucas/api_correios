import axios from 'axios';
import type { TrackingClient } from '../services/trackingService.js';

const MULTI_CHUNK_SIZE = 20;

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
    return { carrier: 'CARRIER_CORREIOS', json: JSON.stringify(res.data) };
  }

  async trackMany(codes: string[]): Promise<Map<string, { carrier?: string; json?: string } | Error>> {
    const out = new Map<string, { carrier?: string; json?: string } | Error>();

    for (let i = 0; i < codes.length; i += MULTI_CHUNK_SIZE) {
      const chunk = codes.slice(i, i + MULTI_CHUNK_SIZE);

      try {
        const res = await axios.post(
          `${this.baseUrl}/rastreamento/multiplos`,
          { codigos: chunk },
          { timeout: this.timeoutMs, headers: this.authHeaders() }
        );
        const data = res.data as Record<string, any>;

        for (const code of chunk) {
          const objeto = data[code];
          if (!objeto) {
            out.set(code, new Error('Code missing from batch response'));
          } else if (objeto.erro) {
            out.set(code, new Error(objeto.mensagem || 'Tracking error'));
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

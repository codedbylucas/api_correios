import axios from 'axios';
import type { TrackingClient } from '../services/trackingService.js';

export class RastreamentoServiceClient implements TrackingClient {
  constructor(
    private baseUrl: string,
    private token?: string,
    private timeoutMs = 30000
  ) {}

  async track(code: string): Promise<{ carrier: string; json: string }> {
    const res = await axios.post(
      `${this.baseUrl}/rastreamento/objeto`,
      { codigo: code },
      {
        timeout: this.timeoutMs,
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
      }
    );
    return { carrier: 'CARRIER_CORREIOS', json: JSON.stringify(res.data) };
  }
}

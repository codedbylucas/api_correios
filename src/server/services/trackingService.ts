import pLimit from 'p-limit';
import { formatTrackResponse } from '../utils/trackResponseFormatter.js';

export interface TrackingClient {
  track(code: string): Promise<{ carrier?: string; json?: string; [key: string]: any }>;
  trackMany?(codes: string[]): Promise<Map<string, { carrier?: string; json?: string } | Error>>;
}

export interface TrackResult {
  code: string;
  ok: boolean;
  data?: any;
  error?: {
    message: string;
    status?: number;
    details?: any;
  };
}

export interface BatchTrackResponse {
  requested: number;
  succeeded: number;
  failed: number;
  results: TrackResult[];
}

export class TrackingService {
  private client: TrackingClient;
  private concurrency: number;
  private isSimulation: boolean;

  constructor(client: TrackingClient, concurrency: number, isSimulation = false) {
    this.client = client;
    this.concurrency = concurrency;
    this.isSimulation = isSimulation;
  }

  private buildResult(code: string, envelopeOrError: { carrier?: string; json?: string } | Error | undefined): TrackResult {
    if (envelopeOrError instanceof Error) {
      const error = envelopeOrError as any;
      console.error(`[TrackingService] Error tracking code ${code}:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      return {
        code,
        ok: false,
        error: {
          message: error.message || 'Unknown error',
          status: error.response?.status,
          details: error.response?.data,
        },
      };
    }

    if (!envelopeOrError) {
      return { code, ok: false, error: { message: 'No response for this code' } };
    }

    return { code, ok: true, data: formatTrackResponse(envelopeOrError) };
  }

  async trackBatch(codes: string[]): Promise<BatchTrackResponse> {
    if (codes.length > 1 && !this.isSimulation && typeof this.client.trackMany === 'function') {
      const envelopes = await this.client.trackMany(codes);
      const results = codes.map((code) => this.buildResult(code, envelopes.get(code)));

      return {
        requested: codes.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      };
    }

    const limit = pLimit(this.concurrency);

    const tasks = codes.map((code) =>
      limit(async (): Promise<TrackResult> => {
        if (this.isSimulation) {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

          // Randomly fail 10% of the time for realism
          if (Math.random() < 0.1) {
            return {
              code,
              ok: false,
              error: {
                message: 'Simulated failure',
                status: 500,
                details: 'This is a mock error for testing purposes.'
              }
            };
          }

          return {
            code,
            ok: true,
            data: formatTrackResponse({
              carrier: 'CARRIER_CORREIOS',
              json: JSON.stringify({
                codObjeto: code,
                eventos: [
                  {
                    dtHrCriado: { date: '2026-02-05 15:16:23.000000' },
                    descricao: 'Objeto postado',
                    unidade: {
                      tipo: 'Agência dos Correios',
                      endereco: { cidade: 'BELO HORIZONTE', uf: 'MG' }
                    }
                  }
                ]
              })
            })
          };
        }

        try {
          const envelope = await this.client.track(code);
          return this.buildResult(code, envelope);
        } catch (error: any) {
          return this.buildResult(code, error);
        }
      })
    );

    const results = await Promise.all(tasks);

    return {
      requested: codes.length,
      succeeded: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    };
  }
}

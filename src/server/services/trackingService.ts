import pLimit from 'p-limit';
import { WoncaClient } from '../clients/woncaClient';
import { formatWoncaResponse } from '../utils/woncaFormatter';

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
  private woncaClient: WoncaClient;
  private concurrency: number;
  private isSimulation: boolean;

  constructor(woncaClient: WoncaClient, concurrency: number, isSimulation = false) {
    this.woncaClient = woncaClient;
    this.concurrency = concurrency;
    this.isSimulation = isSimulation;
  }

  async trackBatch(codes: string[]): Promise<BatchTrackResponse> {
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
            data: formatWoncaResponse({
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
          const envelope = await this.woncaClient.track(code);
          const formattedData = formatWoncaResponse(envelope);
          
          return {
            code,
            ok: true,
            data: formattedData,
          };
        } catch (error: any) {
          console.error(`[TrackingService] Error tracking code ${code}:`, {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
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

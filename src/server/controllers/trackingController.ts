import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { TrackingService } from '../services/trackingService.js';
import { importarRespostaDoSite, RespostaInvalidaError } from '../utils/importarRespostaSite.js';

export class TrackingController {
  private trackingService: TrackingService;

  constructor(trackingService: TrackingService) {
    this.trackingService = trackingService;
  }

  // Coleta assistida: importa o que uma pessoa copiou do site oficial (ver importarRespostaSite.ts).
  // Privacidade: o texto colado nunca e registrado em log nem devolvido nas mensagens de erro.
  importar = (req: Request, res: Response) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: "text must be a string with the pasted response (2 to 2,000,000 characters)" });
    }
    try {
      return res.json(importarRespostaDoSite(req.body.text));
    } catch (error: any) {
      if (error instanceof RespostaInvalidaError) return res.status(400).json({ error: error.message });
      console.error("[TrackingController] import failed:", error?.name);
      return res.status(500).json({ error: "Internal server error" });
    }
  };

  trackBatch = async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { codes } = req.body;
      console.log(`[TrackingController] Received batch request for ${codes?.length} codes`);
      
      // Remove duplicates
      const uniqueCodes = Array.from(new Set(codes as string[]));
      
      const result = await this.trackingService.trackBatch(uniqueCodes);
      
      // If only one code was requested, return the formatted data directly (or error)
      if (uniqueCodes.length === 1) {
        const firstResult = result.results[0];
        if (firstResult.ok) {
          return res.json(firstResult.data);
        } else {
          return res.status(firstResult.error?.status || 500).json({
            code: firstResult.code,
            error: firstResult.error?.message || 'Unknown error',
            details: firstResult.error?.details
          });
        }
      }

      // For multiple codes, return a simplified array of results
      const simplifiedResults = result.results.map(r => {
        if (r.ok) {
          return r.data;
        } else {
          return {
            code: r.code,
            ok: false,
            error: r.error?.message,
            status: r.error?.status
          };
        }
      });

      console.log(`[TrackingController] Batch processed. Success: ${result.succeeded}, Failed: ${result.failed}`);
      res.json(simplifiedResults);
    } catch (error: any) {
      console.error('Batch tracking failed:', error);
      res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message 
      });
    }
  };
}

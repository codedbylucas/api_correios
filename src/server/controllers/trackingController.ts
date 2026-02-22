import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { TrackingService } from '../services/trackingService';

export class TrackingController {
  private trackingService: TrackingService;

  constructor(trackingService: TrackingService) {
    this.trackingService = trackingService;
  }

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
      console.log(`[TrackingController] Batch processed. Success: ${result.succeeded}, Failed: ${result.failed}`);
      res.json(result);
    } catch (error: any) {
      console.error('Batch tracking failed:', error);
      res.status(500).json({ 
        error: 'Internal server error', 
        message: error.message 
      });
    }
  };
}

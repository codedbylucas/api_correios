import { OcrCaptchaSolver } from './ocrCaptchaSolver.js';
import { ThirdPartyCaptchaSolver } from './thirdPartyCaptchaSolver.js';

export interface CaptchaSolver {
  solve(imageBuffer: Buffer): Promise<string>;
}

export function createCaptchaSolver(): CaptchaSolver {
  const provider = (process.env.CAPTCHA_SOLVER || 'ocr').toLowerCase();

  if (provider === 'ocr') {
    return new OcrCaptchaSolver();
  }

  if (provider === '2captcha' || provider === 'anticaptcha') {
    const apiKey = process.env.CAPTCHA_API_KEY;
    if (!apiKey) {
      throw new Error(`CAPTCHA_API_KEY is required when CAPTCHA_SOLVER=${provider}.`);
    }
    return new ThirdPartyCaptchaSolver(provider, apiKey);
  }

  throw new Error(`Unknown CAPTCHA_SOLVER "${provider}". Expected "ocr", "2captcha" or "anticaptcha".`);
}

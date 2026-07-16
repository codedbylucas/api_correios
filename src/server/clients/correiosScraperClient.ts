import axios from 'axios';
import type { CaptchaSolver } from '../scraper/captchaSolver.js';

const BASE_URL = 'https://rastreamento.correios.com.br';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export interface ScraperTrackResponse {
  carrier: string;
  json: string;
}

class CookieJar {
  private jar: Record<string, string> = {};

  absorb(setCookieHeaders?: string[]) {
    for (const line of setCookieHeaders || []) {
      const pair = line.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > 0) this.jar[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  }

  header(): string {
    return Object.entries(this.jar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CorreiosScraperClient {
  constructor(
    private captchaSolver: CaptchaSolver,
    private maxCaptchaRetries = 3,
    private requestDelayMs = 1500
  ) {}

  private async fetchCaptcha(jar: CookieJar): Promise<Buffer> {
    const res = await axios.get(`${BASE_URL}/core/securimage/securimage_show.php`, {
      headers: { 'User-Agent': USER_AGENT, Cookie: jar.header() },
      responseType: 'arraybuffer',
    });
    jar.absorb(res.headers['set-cookie']);
    return Buffer.from(res.data);
  }

  private async startSession(): Promise<CookieJar> {
    const jar = new CookieJar();
    const res = await axios.get(`${BASE_URL}/app/index.php`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    jar.absorb(res.headers['set-cookie']);
    return jar;
  }

  async track(code: string): Promise<ScraperTrackResponse> {
    let lastError: string = 'unknown error';

    for (let attempt = 0; attempt < this.maxCaptchaRetries; attempt++) {
      if (attempt > 0) await sleep(this.requestDelayMs);

      const jar = await this.startSession();
      const captchaImage = await this.fetchCaptcha(jar);
      const answer = await this.captchaSolver.solve(captchaImage);

      await sleep(this.requestDelayMs);

      const res = await axios.get(`${BASE_URL}/app/resultado.php`, {
        params: { objeto: code, captcha: answer, mqs: 'S' },
        headers: { 'User-Agent': USER_AGENT, Cookie: jar.header(), Accept: 'application/json' },
      });

      if (res.data?.erro) {
        lastError = res.data.mensagem || 'captcha rejected';
        console.log(`[CorreiosScraperClient] attempt ${attempt + 1}/${this.maxCaptchaRetries} for ${code} failed: ${lastError}`);
        continue;
      }

      return { carrier: 'CARRIER_CORREIOS', json: JSON.stringify(res.data) };
    }

    throw new Error(`Failed to solve captcha after ${this.maxCaptchaRetries} attempts: ${lastError}`);
  }
}

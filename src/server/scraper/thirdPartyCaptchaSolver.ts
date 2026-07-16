import axios from 'axios';
import type { CaptchaSolver } from './captchaSolver.js';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function solveVia2Captcha(imageBuffer: Buffer, apiKey: string): Promise<string> {
  const submit = await axios.post('https://2captcha.com/in.php', null, {
    params: { key: apiKey, method: 'base64', body: imageBuffer.toString('base64'), json: 1, numeric: 4, min_len: 4, max_len: 8 },
  });
  if (submit.data.status !== 1) {
    throw new Error(`2Captcha submit failed: ${submit.data.request}`);
  }
  const captchaId = submit.data.request;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await axios.get('https://2captcha.com/res.php', {
      params: { key: apiKey, action: 'get', id: captchaId, json: 1 },
    });
    if (poll.data.status === 1) return poll.data.request;
    if (poll.data.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`2Captcha poll failed: ${poll.data.request}`);
    }
  }
  throw new Error('2Captcha: timed out waiting for solution.');
}

async function solveViaAntiCaptcha(imageBuffer: Buffer, apiKey: string): Promise<string> {
  const create = await axios.post('https://api.anti-captcha.com/createTask', {
    clientKey: apiKey,
    task: { type: 'ImageToTextTask', body: imageBuffer.toString('base64') },
  });
  if (create.data.errorId) {
    throw new Error(`Anti-Captcha createTask failed: ${create.data.errorDescription}`);
  }
  const taskId = create.data.taskId;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const result = await axios.post('https://api.anti-captcha.com/getTaskResult', { clientKey: apiKey, taskId });
    if (result.data.errorId) {
      throw new Error(`Anti-Captcha getTaskResult failed: ${result.data.errorDescription}`);
    }
    if (result.data.status === 'ready') return result.data.solution.text;
  }
  throw new Error('Anti-Captcha: timed out waiting for solution.');
}

export class ThirdPartyCaptchaSolver implements CaptchaSolver {
  constructor(private provider: '2captcha' | 'anticaptcha', private apiKey: string) {}

  async solve(imageBuffer: Buffer): Promise<string> {
    return this.provider === '2captcha'
      ? solveVia2Captcha(imageBuffer, this.apiKey)
      : solveViaAntiCaptcha(imageBuffer, this.apiKey);
  }
}

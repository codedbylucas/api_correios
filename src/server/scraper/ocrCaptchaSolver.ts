import { Jimp } from 'jimp';
import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { CaptchaSolver } from './captchaSolver.js';

const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// O captcha da Securimage usada pelos Correios desenha o texto num tom de
// cinza mais claro que as linhas de ruído — isolar essa faixa de cinza e
// descartar o resto remove a maior parte do ruído antes do OCR.
const TEXT_GRAY_CENTER = 144;
const TEXT_GRAY_TOLERANCE = 14;
const UPSCALE_FACTOR = 4;

async function isolateText(imageBuffer: Buffer): Promise<Buffer> {
  const img = await Jimp.read(imageBuffer);
  img.scan(0, 0, img.width, img.height, function (_x: number, _y: number, idx: number) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const gray = (r + g + b) / 3;
    const isText = Math.abs(gray - TEXT_GRAY_CENTER) <= TEXT_GRAY_TOLERANCE;
    const value = isText ? 0 : 255;
    this.bitmap.data[idx] = value;
    this.bitmap.data[idx + 1] = value;
    this.bitmap.data[idx + 2] = value;
  });
  img.resize({ w: img.width * UPSCALE_FACTOR });
  return img.getBuffer('image/png');
}

let workerPromise: Promise<Worker> | null = null;
function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng').then(async (worker) => {
      await worker.setParameters({
        tessedit_char_whitelist: ALPHANUMERIC,
        tessedit_pageseg_mode: PSM.SINGLE_WORD,
      });
      return worker;
    });
  }
  return workerPromise;
}

export class OcrCaptchaSolver implements CaptchaSolver {
  async solve(imageBuffer: Buffer): Promise<string> {
    const cleaned = await isolateText(imageBuffer);
    const worker = await getWorker();
    const { data } = await worker.recognize(cleaned);
    return data.text.replace(/[^a-zA-Z0-9]/g, '').trim();
  }
}

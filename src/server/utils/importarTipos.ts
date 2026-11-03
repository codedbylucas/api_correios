export type ItemImportado =
  | { code: string | null; carrier: string | null; lastUpdate: string | null; events: unknown[] }
  | { code: string; ok: false; error: string; status: number };

export class RespostaInvalidaError extends Error {}

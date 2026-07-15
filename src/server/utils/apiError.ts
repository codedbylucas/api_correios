export type ApiErrorCode = 'unauthenticated' | 'invalid_argument' | 'not_found' | 'internal';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  invalid_argument: 400,
  not_found: 404,
  internal: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function sendApiError(res: import('express').Response, error: unknown) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ code: error.code, message: error.message });
  }

  console.error('[apiError] unexpected error:', error);
  return res.status(500).json({ code: 'internal', message: 'Internal server error' });
}

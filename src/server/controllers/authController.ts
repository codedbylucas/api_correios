import { Request, Response } from 'express';
import { SESSION_COOKIE, createPasswordReset, login, logout, resetPassword } from '../services/userService.js';
import { sendApiError } from '../utils/apiError.js';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Default: secure em produção. Override explícito via COOKIE_SECURE=false
// pra quando o site ainda é servido em HTTP puro (ex: VPS sem domínio/TLS
// ainda configurado) — um cookie secure nunca é enviado pelo navegador numa
// conexão HTTP, o que quebraria o login silenciosamente nesse cenário.
const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/',
  });
}

export async function loginUser(req: Request, res: Response) {
  try {
    const auth = await login(req.body.email, req.body.password);
    setSessionCookie(res, auth.token);
    res.json({ user: auth.user });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function logoutUser(req: Request, res: Response) {
  try {
    await logout(req.cookies?.[SESSION_COOKIE]);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    sendApiError(res, error);
  }
}

export function me(_req: Request, res: Response) {
  res.json({ user: res.locals.user ?? null });
}

export async function forgotPassword(req: Request, res: Response) {
  try {
    const resetToken = await createPasswordReset(req.body.email);
    res.json({
      ok: true,
      ...(process.env.NODE_ENV !== 'production' && resetToken ? { resetToken } : {}),
    });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function resetUserPassword(req: Request, res: Response) {
  try {
    await resetPassword(req.body.token, req.body.password);
    res.json({ ok: true });
  } catch (error) {
    sendApiError(res, error);
  }
}

import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { passwordResetTokens, sessions, users } from '../db/schema.js';
import { addDays, addHours, generateToken, hashPassword, hashToken, verifyPassword } from '../utils/auth.js';
import { ApiError } from '../utils/apiError.js';
import { deleteDevSession, getDevSession, saveDevSession } from './devAuthStore.js';

export const SESSION_COOKIE = 'cronos_session';
const SESSION_DAYS = 30;
const RESET_HOURS = 1;

// Bypass local para login sem banco: nunca ativa em produção, e só entra em
// ação se as duas env vars estiverem setadas — a sessão fica só em memória
// (some ao reiniciar o servidor), sem tocar no Postgres.
const DEV_AUTH_EMAIL = process.env.DEV_AUTH_EMAIL;
const DEV_AUTH_PASSWORD = process.env.DEV_AUTH_PASSWORD;
const DEV_AUTH_ENABLED = process.env.NODE_ENV !== 'production' && !!DEV_AUTH_EMAIL && !!DEV_AUTH_PASSWORD;

if (DEV_AUTH_ENABLED) {
  console.warn(
    '[userService] DEV_AUTH_EMAIL/DEV_AUTH_PASSWORD estão setados — login está usando sessão em memória, sem banco. Nunca defina essas variáveis em produção.'
  );
}

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

export async function createUser(input: { email: string; password: string; name?: string }) {
  if (!input.email || !input.password) {
    throw new ApiError('invalid_argument', 'email and password are required.');
  }
  if (input.password.length < 8) {
    throw new ApiError('invalid_argument', 'password must be at least 8 characters.');
  }

  const [user] = await db
    .insert(users)
    .values({
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
      name: input.name?.trim() || null,
    })
    .returning();

  return toPublicUser(user);
}

export async function login(email: string, password: string) {
  if (DEV_AUTH_ENABLED) {
    if (normalizeEmail(email) === normalizeEmail(DEV_AUTH_EMAIL!) && password === DEV_AUTH_PASSWORD) {
      const user: PublicUser = { id: 'dev-user', email: normalizeEmail(DEV_AUTH_EMAIL!), name: 'Dev (sem banco)', createdAt: new Date() };
      const token = generateToken('sess');
      saveDevSession(hashToken(token), { session: null, user, expiresAt: addDays(SESSION_DAYS) });
      return { user, session: null, token };
    }
    if (!process.env.DATABASE_URL) {
      // Sem banco configurado: não dá pra checar contra usuários reais, então
      // qualquer credencial que não seja a de dev vira 401 em vez do 500 que
      // viria de tentar consultar o Postgres inexistente.
      throw new ApiError('unauthenticated', 'Invalid email or password.');
    }
  }

  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError('unauthenticated', 'Invalid email or password.');
  }

  const token = generateToken('sess');
  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: addDays(SESSION_DAYS),
      lastUsedAt: new Date(),
    })
    .returning();

  return { user: toPublicUser(user), session, token };
}

export async function findSession(token?: string) {
  if (!token) return null;

  if (DEV_AUTH_ENABLED) {
    return getDevSession(hashToken(token));
  }

  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;

  db.update(sessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(sessions.id, row.session.id))
    .catch((error) => console.error('[sessionAuth] failed to update last_used_at:', error));

  return { session: row.session, user: toPublicUser(row.user) };
}

export async function logout(token?: string) {
  if (!token) return;
  if (DEV_AUTH_ENABLED) {
    deleteDevSession(hashToken(token));
    return;
  }
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function createPasswordReset(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  if (!user) return null;

  const token = generateToken('reset');
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: addHours(RESET_HOURS),
  });

  return token;
}

export async function resetPassword(token: string, password: string) {
  if (!token || !password) {
    throw new ApiError('invalid_argument', 'token and password are required.');
  }
  if (password.length < 8) {
    throw new ApiError('invalid_argument', 'password must be at least 8 characters.');
  }

  const [reset] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, hashToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
    .limit(1);

  if (!reset) {
    throw new ApiError('invalid_argument', 'Invalid or expired reset token.');
  }

  await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, reset.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, reset.id));
  await db.delete(sessions).where(eq(sessions.userId, reset.userId));
}

import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

let instance: NeonHttpDatabase<typeof schema> | undefined;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Configure a Postgres connection string (Neon or Vercel Postgres).');
    }
    instance = drizzle(neon(connectionString), { schema });
  }
  return instance;
}

// Lazily constructed so importing this module (e.g. transitively via routes
// wired up at server startup) doesn't require DATABASE_URL unless a
// DB-backed route is actually hit.
export const db: NeonHttpDatabase<typeof schema> = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

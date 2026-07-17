import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

let instance: NodePgDatabase<typeof schema> | undefined;

function getDb(): NodePgDatabase<typeof schema> {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Configure a Postgres connection string (local Docker, Neon or Vercel Postgres).');
    }
    instance = drizzle(new Pool({ connectionString }), { schema });
  }
  return instance;
}

// Lazily constructed so importing this module (e.g. transitively via routes
// wired up at server startup) doesn't require DATABASE_URL unless a
// DB-backed route is actually hit.
export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

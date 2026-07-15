import 'dotenv/config';
import { db } from '../src/server/db/client.js';
import { apiKeys } from '../src/server/db/schema.js';
import { generateApiKey, hashApiKey } from '../src/server/utils/signing.js';

async function main() {
  const name = process.argv[2] || 'default';

  const key = generateApiKey();
  const keyHash = hashApiKey(key);

  const [record] = await db.insert(apiKeys).values({ name, keyHash }).returning();

  console.log(`API key created: "${name}" (id: ${record.id})`);
  console.log('');
  console.log(key);
  console.log('');
  console.log('Store this key now — it is not saved anywhere in plaintext and will not be shown again.');
}

main().catch((error) => {
  console.error('[createApiKey] failed:', error);
  process.exit(1);
});

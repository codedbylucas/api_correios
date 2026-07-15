import 'dotenv/config';
import { createUser } from '../src/server/services/userService.js';

async function main() {
  const [, , email, password, ...nameParts] = process.argv;
  const name = nameParts.join(' ') || undefined;

  if (!email || !password) {
    console.error('Usage: npm run auth:create-user -- email@example.com password [name]');
    process.exit(1);
  }

  const user = await createUser({ email, password, name });
  console.log(`User created: ${user.email} (id: ${user.id})`);
}

main().catch((error) => {
  console.error('[createUser] failed:', error);
  process.exit(1);
});

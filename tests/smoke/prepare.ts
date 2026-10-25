/**
 * Prepara la BD smoke: guard `_test` -> `prisma db push` (crea la BD si no
 * existe) -> seed. Cualquier escritura pasa antes por el guard.
 *
 * Uso: tsx --env-file=.env tests/smoke/prepare.ts
 * Override opcional: SMOKE_DATABASE_URL=mysql://.../otra_test
 */
import { spawnSync } from 'node:child_process';
import { resolveSmokeDatabaseUrl } from './smokeEnv';
import { seedTestDb } from './seed-test';
import { databaseNameFromUrl } from './testDb';

async function main() {
  const url = resolveSmokeDatabaseUrl(); // lanza si el nombre no termina en _test
  console.log(`[smoke] BD de pruebas: ${databaseNameFromUrl(url)}`);

  const push = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: url },
  });
  if (push.status !== 0) throw new Error('prisma db push falló (¿el usuario MySQL puede CREATE DATABASE?)');

  await seedTestDb(url);
  console.log('[smoke] Seed listo.');
}

main().catch((e) => {
  console.error(`[smoke] ${e instanceof Error ? e.message : 'error desconocido'}`);
  process.exit(1);
});

/**
 * Seed para TestSprite: seed smoke normal + una sucursal aislada por caso
 * (TC001..TC030). Solo escribe en una BD `_test`.
 *
 * Uso: tsx --env-file=.env tests/smoke/seed-testsprite.ts
 */
import { TESTSPRITE, resolveSmokeDatabaseUrl } from './smokeEnv';
import { seedTestDb, seedTestSpriteBranches } from './seed-test';
import { databaseNameFromUrl } from './testDb';

async function main() {
  const url = resolveSmokeDatabaseUrl(); // lanza si el nombre no termina en _test
  console.log(`[testsprite] BD de pruebas: ${databaseNameFromUrl(url)}`);
  await seedTestDb(url);
  await seedTestSpriteBranches(url, TESTSPRITE.count);
  console.log(`[testsprite] Seed listo: smoke + ${TESTSPRITE.count} sucursales.`);
}

main().catch((e) => {
  console.error(`[testsprite] ${e instanceof Error ? e.message : 'error desconocido'}`);
  process.exit(1);
});

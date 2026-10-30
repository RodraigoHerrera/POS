import { assertTestDatabaseUrl, deriveTestDatabaseUrl } from './testDb';

/** Constantes compartidas por seed, config de Playwright y specs. */
export const SMOKE = {
  port: 3100,
  sucursalCorreo: 'smoke@smash.test',
  sucursalPassword: 'SmokeTest2026!',
  pin: '1234',
  cajero: 'cajero_smoke',
  admin: 'admin_smoke',
  producto: 'Hamburguesa Smoke',
  precio: 50,
} as const;

/** Casos TestSprite: una sucursal aislada por caso (tc001@smash.test, admin_tc001, ...). */
export const TESTSPRITE = { count: 70 } as const;

/** Id de caso en minúsculas con 3 dígitos: 1 -> "tc001". */
export function testSpriteId(n: number): string {
  return `tc${String(n).padStart(3, '0')}`;
}

/**
 * URL efectiva de la BD smoke. `SMOKE_DATABASE_URL` tiene prioridad (útil para
 * apuntar a otra BD de pruebas); si no, se deriva de `DATABASE_URL` cambiando
 * solo el nombre. Siempre pasa por el guard `_test`.
 */
export function resolveSmokeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.SMOKE_DATABASE_URL ?? deriveTestDatabaseUrl(env.DATABASE_URL);
  assertTestDatabaseUrl(url);
  return url;
}

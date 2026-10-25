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

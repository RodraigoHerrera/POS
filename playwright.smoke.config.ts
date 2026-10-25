import { defineConfig, devices } from "@playwright/test";
import { SMOKE, resolveSmokeDatabaseUrl } from "./tests/smoke/smokeEnv";

// Config separada de playwright.config.ts: servidor propio en otro puerto,
// apuntando SIEMPRE a la BD `*_test` (el guard lanza si el nombre no termina en _test).
try {
  process.loadEnvFile(".env"); // no pisa variables ya definidas
} catch {
  /* sin .env: se espera DATABASE_URL / SMOKE_DATABASE_URL en el entorno */
}
const databaseUrl = resolveSmokeDatabaseUrl();
const baseURL = `http://localhost:${SMOKE.port}`;

export default defineConfig({
  testDir: "./tests/smoke",
  testMatch: /.*\.spec\.ts/,
  // El dev server compila cada ruta on-demand en la primera visita.
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "./test-results/smoke",
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 120_000,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx next dev -p ${SMOKE.port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    // process.env tiene prioridad sobre .env en Next: el servidor usa la BD de pruebas.
    env: { DATABASE_URL: databaseUrl, NEXT_DIST_DIR: ".next-smoke", NEXT_TELEMETRY_DISABLED: "1" },
  },
});

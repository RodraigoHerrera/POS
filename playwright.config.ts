import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Next.js dev compila cada ruta on-demand la primera vez que se visita,
  // lo que puede sumar varios minutos en una corrida en frío. Para la
  // defensa real, conviene pre-calentar las rutas o usar `next build && next start`.
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 10_000,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "ci",
      use: { ...devices["Desktop Chrome"] },
      retries: 1,
    },
    {
      name: "demo",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        launchOptions: { slowMo: 250 },
        video: "on",
        trace: "on",
      },
      retries: 0,
    },
  ],
});

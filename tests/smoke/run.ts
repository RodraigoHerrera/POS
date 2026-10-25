/**
 * Orquestador de `npm run test:smoke`: prepara la BD de pruebas (guard + push +
 * seed) y ejecuta Playwright con la config smoke. `next dev` reescribe
 * tsconfig.json (reformatea y añade `.next-smoke/types`); se restaura al final.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TSCONFIG = 'tsconfig.json';
const original = readFileSync(TSCONFIG, 'utf8');
let code = 1;
try {
  const prep = spawnSync('npx', ['tsx', '--env-file=.env', 'tests/smoke/prepare.ts'], { stdio: 'inherit', shell: true });
  if (prep.status === 0) {
    const pw = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.smoke.config.ts', ...process.argv.slice(2)], {
      stdio: 'inherit',
      shell: true,
    });
    code = pw.status ?? 1;
  }
} finally {
  if (readFileSync(TSCONFIG, 'utf8') !== original) writeFileSync(TSCONFIG, original);
}
process.exit(code);

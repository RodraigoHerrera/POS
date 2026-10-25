# Feature: e2e-smoke

## Objective
On-demand Playwright smoke suite for critical flows, running against an isolated MySQL test database, never the dev/demo DB.

## Problem / Why
Unit tests cannot verify UI + API + DB integration or the print view (e.g. the "Cierre de Caja" receipt). The current Playwright config runs `npm run dev` with `reuseExistingServer: true`, which hits the real `smash` DB. User decided (2026-10-25): e2e only as on-demand smoke tests on a separate test DB.

## Scope
- Test DB `smash_test` on local MySQL (same user/host/port as `.env` `DATABASE_URL`, only the DB name changes). Schema via `prisma db push` (repo has only 2 migrations; the base schema is not migration-managed).
- Minimal deterministic seed for the test DB (sucursal, admin, cajero, a few sellable products with stock/recipe as needed by the flows) — separate script, not `seed-demo.ts`.
- Safety guard: setup and seed abort unless the DB name in the effective URL ends with `_test`.
- Playwright: dedicated smoke config/project that starts its own server on port 3100 with `DATABASE_URL` pointing to `smash_test`, `reuseExistingServer: false`. Existing `ci`/`demo` projects and `tests/e2e/demo.spec.ts`, `produccion.spec.ts` untouched.
- Smoke tests (`tests/smoke/`): (1) caja: open → sell → close → receipt shows dates, methods, opening/counted cash, difference; print media emulation shows only the receipt (buttons hidden), `window.print` stubbed. (2) admin dashboard: Mes/Semana toggle switches labels and refetches.
- Script `npm run test:smoke` that prepares the DB (push + seed) and runs the suite.

## Constraints
- Never touch the dev/demo DB; never run `db:seed:demo`.
- Smoke suite is on demand only; not part of per-change verification.
- Do not modify existing e2e files.
- Do not touch unrelated uncommitted user changes in the worktree.

## Tasks
- [x] T1 Test DB URL helper + `_test` guard (pure, unit-tested)
- [x] T2 Test seed script + DB prepare script (db push + seed)
- [x] T3 Playwright smoke config (port 3100, own server, test DB)
- [x] T4 Smoke test: caja open → sell → close → receipt + print view
- [x] T5 Smoke test: dashboard Mes/Semana toggle
- [x] T6 `npm run test:smoke` script + run it once, report results

## Acceptance criteria
- `npm run test:smoke` creates/updates `smash_test`, seeds it, and runs the suite green.
- Pointing it at a DB not ending in `_test` aborts before any write.
- Dev DB `smash` is not modified.

## TDD
- Mode: enabled; runner `npx tsx --test` for the guard/URL helper. Smoke tests themselves are the e2e layer.

## Progress
- Created 2026-10-25 on branch `feat/e2e-smoke` (from main + merged feat/dashboard-selector-periodo and feat/caja-ticket-cierre). Next: T1.
- 2026-10-25 implemented T1-T6 (not committed). Files: tests/smoke/{testDb.ts,testDb.test.ts,smokeEnv.ts,seed-test.ts,prepare.ts,run.ts,caja-cierre.spec.ts,dashboard-periodo.spec.ts}, playwright.smoke.config.ts, package.json (`test:smoke`), next.config.ts (`distDir` from `NEXT_DIST_DIR`, so the smoke server uses `.next-smoke` and does not clash with a dev server), .gitignore (`/.next-smoke/`).

## Verification evidence
- `npx tsx --test tests/smoke/testDb.test.ts`: RED (module missing) then GREEN, 6/6 pass.
- Negative: `SMOKE_DATABASE_URL=.../smash npm run test:smoke` -> "Abortado: la base de datos "smash" no termina en "_test"", exit 1, before any connection.
- `npm run test:smoke`: 2 passed (caja-cierre ~40s, dashboard-periodo ~9s); re-run idempotent (seed truncates and re-inserts). `prisma db push` created `smash_test` on first run.
- `npx tsc --noEmit`: exit 0. `npx eslint tests/smoke playwright.smoke.config.ts next.config.ts`: exit 0.
- Dev DB `smash` read-only counts before/after identical (caja 36, pedido 364, empleados 10, historialVentas 622).
- Note: `next dev` rewrites tsconfig.json; `tests/smoke/run.ts` restores it after the run.

## Review
- Native review (high risk, 4 lenses) approved and acknowledged 2026-10-25; no blocking findings. Non-blocking follow-ups:
  - R4/R3 tsconfig-restore-on-signal (WARNING, FIXED 2026-10-25: SIGINT/SIGTERM handlers restore tsconfig; SIGINT at 45s left tsconfig clean, no orphan server on 3100): `run.ts` restores tsconfig.json only in `finally`; Ctrl+C leaves next dev's tsconfig changes. Add SIGINT/SIGTERM handlers or restore from backup on next run.
  - R2/R3 hardcoded-receipt-amounts (WARNING, FIXED 2026-10-25: amounts built from APERTURA/SMOKE.precio; npm run test:smoke 2/2): build expected "Bs" strings from `APERTURA` / `SMOKE.precio`.
  - R4 push-failure-misdiagnosis: report `prisma db push` status/error instead of always blaming CREATE DATABASE privilege.
  - R3 argv-shell-unquoted: `spawnSync` with `shell: true` splits args with spaces.
  - R3 truncate-not-transactional: re-enable FK checks in `finally` instead of `$transaction`.
  - R3 resolve-precedence-untested: unit tests for `resolveSmokeDatabaseUrl` (SMOKE_DATABASE_URL priority, empty value).
  - R2 misc: repeated `__printCalls` window cast; guard messages name DATABASE_URL even when SMOKE_DATABASE_URL is used; bare `_test` name message.

## Next step
Commit the two WARNING fixes (uncommitted, not reviewed). Remaining SUGGESTION follow-ups above. Smoke suite is on demand only (`npm run test:smoke`).

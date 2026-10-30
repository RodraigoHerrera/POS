# Stable environment for TestSprite runs

## Objective
Make the TestSprite frontend suite run without environment-caused failures, then re-run it.

## Problem / Why
First run (2026-10-30, report `testsprite_tests/testsprite-mcp-test-report.md`): 10/30 passed; the other 20 failed or were blocked by the environment, not by app logic:
- 9 cases: login rate limit (15 req/min per IP). All tests share the TestSprite tunnel IP.
- 7 cases: `PrismaClientInitializationError: Can't reach database server at localhost:3306`. MySQL itself was fine (Max_used_connections=9 of 151, Connection_errors_*=0, no restart), so the client connect timed out (Windows `localhost` resolution + machine under load).
- 4 cases: every test shares one branch, so the register opened by one test breaks the others ("Ya tienes una caja abierta").

## Scope
- Rate limits relaxable for test runs only: honored only when explicitly enabled AND the connected database name ends in `_test`.
- Test seed creates one isolated branch (with its own admin, cashier, product and stock) per TestSprite case.
- Test server launch uses `127.0.0.1` and a longer `connect_timeout` (launcher/env only, no app code).
- Re-run the suite with per-test credentials.

## Out of scope
- Register apertura UX bug (repeated alert instead of redirect when a register is already open). Reported, not fixed here.
- Pool tuning (not supported by evidence).

## Constraints
- Production behavior of rate limits must not change; the relaxation cannot be enabled against a non-`_test` database.
- Never touch the `smash` dev database.

## TDD
- Mode: strict (source: user global CLAUDE.md). Runner: `npx tsx --test <file>.test.ts`.

## Tasks
- [x] T1 Rate limit relaxation gated by env flag + `_test` database (tests RED→GREEN).
- [x] T2 Seed one isolated branch per TestSprite case (TC001..TC030).
- [ ] T3 Re-run TestSprite (production build on :3100 against `smash_test`, 127.0.0.1 + connect_timeout) with per-test credentials; update report.

## Acceptance criteria
- Unit tests prove: relaxed only with flag AND `_test` DB; default limits unchanged otherwise.
- Seed creates 30 isolated branches plus the existing smoke branch; existing smoke tests unaffected.
- Re-run shows no rate-limit, DB-connect or shared-register failures (remaining failures, if any, are app findings).

## Progress
- Diagnosis done (MySQL counters read-only).
- T1 done: `limitesRelajados()` in `src/lib/rate-limit.ts` (RATE_LIMIT_RELAXED==="true" AND DB name ends `_test`); helpers checkRateLimit/isLocked/recordFailure scale limit x100 when relaxed. RED observed (new tests failed before implementation), GREEN: `npx tsx --test src/lib/rate-limit.test.ts` 18/18.
- T2 done: `tests/smoke/seed-test.ts` refactored (crearCatalogo/crearSucursal), new `seedTestSpriteBranches`, CLI `tests/smoke/seed-testsprite.ts`, `TESTSPRITE`/`testSpriteId` in smokeEnv. Ran against `smash_test`: 31 sucursales, 62 empleados, 62 inventarioSucursal, 62 stockLoteSucursal, 1 producto.
- Checks: full `src/**/*.test.ts` 600/600 pass, `tsc --noEmit` clean, eslint clean on touched files.

## Next step
T3: rebuild/launch prod build on :3100 against smash_test with RATE_LIMIT_RELAXED=true, 127.0.0.1 and connect_timeout; re-run TestSprite with per-test credentials (tcNNN@smash.test / SmokeTest2026!, admin_tcNNN / cajero_tcNNN, PIN 1234).

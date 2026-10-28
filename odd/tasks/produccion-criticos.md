# Feature: produccion-criticos

## Objective
Fix the two critical findings from the `admin/produccion` audit (2026-10-28).

## Problem / Why
1. `executeProductionBatch` (server action) had no authentication and trusted a client-supplied `sucursalId`: anyone with the action ID could deduct stock and create lots in any branch.
2. Any recipe could be "produced", including `vendible` items whose recipes are already exploded at sale time (`caja/registrarPedido`), causing double ingredient deduction and orphan stock.

## Scope
- New `src/lib/produccion.ts`: input validation, producible-item guard, transaction body (`ejecutarProduccionTx`), and auth-gated entry point (`ejecutarProduccion`).
- `src/app/actions/produccion.ts`: thin server action delegating to the lib.
- `page.tsx` / `ProductionClient.tsx`: list only `prep` recipes; branch comes from the session (no selector).

## Constraints
- High findings added by user request (T3-T5). Still out of scope: error leakage, audit trail, expired-lot policy.

## Tasks
- [x] T1 Auth gate + session-scoped branch (Administrador only; body `sucursalId` ignored)
- [x] T2 Only `prep` items can be produced (server guard + page filter)
- [x] T3 Apply recipe `rendimiento` and `merma_pct` (MRP formula; waste >= 100% rejected)
- [x] T4 FEFO: lots without expiry last (in-memory sort, matches `simularConsumoFEFO`)
- [x] T5 `runWithRetry` (15s) instead of Serializable; guarded lot decrement; output stock via increment

## Acceptance criteria
- Calling the action without a valid Administrador session fails without touching the DB.
- All writes use the session branch.
- Producing a non-`prep` item is rejected inside the transaction.

## TDD
- Mode: enabled (source: CLAUDE.md). Runner: `npx tsx --test src/lib/produccion.test.ts`.

## Progress / Evidence
- RED: `npx tsx --test src/lib/produccion.test.ts` failed (module missing).
- GREEN: same command, 12/12 passing.
- `tsc --noEmit`: no errors in touched files.
- ESLint: `no-explicit-any` errors on `tx: any` / `catch (error: any)`, same pre-existing pattern as `src/lib/mermas.ts`.
- Not run: manual UI check, Administrador-vs-Cajero 403 path (requires DB).
- T3-T5 RED: 9 failing; GREEN: 20/20 (`npx tsx --test src/lib/produccion.test.ts`). tsc clean on touched files.
- Not run: real-DB concurrency (production vs sale on same lot).
- RDD: off (global) — not started.

## Next step
- Decide expired-lot policy; then medium findings (error leakage, audit trail).

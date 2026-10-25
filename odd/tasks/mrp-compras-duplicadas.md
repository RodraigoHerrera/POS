# Feature: mrp-compras-duplicadas

## Objective
Stop the MRP from over-buying: fix the three HIGH findings of the 2026-10-25 MRP audit.

## Problem / Why
1. Scheduled receipts are always 0: `src/lib/mrp/data.ts:87` counts only `ordenCompra.estado = "Enviada"`, but nothing in the app ever sets that state; MRP creates `Borrador`. Re-running MRP duplicates every draft.
2. Prep stock is never netted: `src/lib/mrp/explosion.ts` explodes preps straight to raw inputs, so prepared stock (e.g. 5 kg sauce on hand) is ignored and raw inputs are bought for the full requirement.
3. Concurrent runs (double click, two admins) create two full sets of drafts; no server-side guard.

## Decisions
- (User, 2026-10-25) Re-running MRP **replaces** previous MRP drafts: draft OCs of the branch with `mrp_corrida_id != null` and `estado = "Borrador"` become `Anulada` inside the same transaction that saves the new run. Manual OCs (`mrp_corrida_id = null`) are never touched. `Enviada` OCs keep counting as scheduled receipts.
- Prep netting: before exploding a prep, subtract its on-hand stock in the branch (consume available prep stock first, explode only the remainder). Available prep stock is shared across all demand paths for that prep within one run (do not reuse the same stock twice).
- Concurrency: serialize runs per branch inside the save transaction (row lock, e.g. `SELECT ... FOR UPDATE` on the `sucursales` row) and reject with 409 if another run for the branch was saved within a short window (e.g. 30 s), so a double click does not produce two runs.

## Scope
- `src/lib/mrp/explosion.ts` (prep netting, pure), `src/lib/mrp/data.ts` (load prep stock if not already loaded), `src/app/api/mrp/ejecutar/route.ts` (anulación of previous MRP drafts, lock + recent-run 409).
- Pure logic extracted where needed so it is unit-testable (e.g. a pure "should reject recent run" helper).
- UI: only if needed to show the 409 message cleanly in `src/components/mrp/MrpPanel.tsx`.
- Out of scope: MEDIUM/LOW audit findings (timezone, rounding, validation, history view, unbounded query).

## Constraints
- Strict TDD with node:test (`npx tsx --test <file>`). No e2e during the task (smoke suite is on demand only).
- No schema change unless strictly required.
- Do not touch unrelated uncommitted user changes.

## Tasks
- [x] T1 Tests + pure prep netting in `explotarMPS` (RED → GREEN)
- [x] T2 Anulación of previous MRP drafts in the save transaction; scheduled receipts keep `Enviada`
- [x] T3 Per-branch lock + recent-run 409 (pure helper tested) + panel message
- [x] T4 Verification: unit tests, tsc, eslint on touched files

## Acceptance criteria
- Running MRP twice leaves only the latest run's drafts active (previous MRP drafts `Anulada`); manual and `Enviada` OCs untouched.
- With 5 kg of a prep on hand and 10 kg required, raw inputs are exploded for 5 kg only.
- Two simultaneous/rapid runs for one branch → one succeeds, the other gets 409.

## TDD
- Mode: enabled (session config); runner `npx tsx --test`.

## Progress
- Created 2026-10-25 on branch `fix/mrp-compras-duplicadas` (from main).
- T1-T4 implemented 2026-10-25 (not committed).
  - `explosion.ts`: `explotarMPS(mps, recetas, stockPreps?)` consumes (mutates) the shared prep-stock map; returns `prepsDeStock`. `data.ts`: `obtenerStockPorItem` (inventarioSucursal.stock, same unit as leaf stock). Route passes one shared map across all products and adds an informational advertencia per consumed prep.
  - `corridaReciente.ts` (pure, 30 s window) + route: inside `runWithRetry` tx: `SELECT ... FROM sucursales FOR UPDATE`, latest-run check -> 409 (`CorridaRecienteError`), `updateMany` Borrador+mrp_corrida_id!=null -> Anulada, then inserts. Response adds `ordenesAnuladas`.
  - `MrpPanel.tsx` unchanged: it already shows `data.error` for non-ok responses (409 included).
- Verification: `npx tsx --test src/lib/mrp/*.test.ts` RED (prep netting + missing corridaReciente module) then GREEN 12/12; `tests/unit/forecast.test.ts` + `interactive-forecast.test.ts` 2/2 pass; `npx tsc --noEmit` clean; eslint on touched files: 1 pre-existing `any` in route catch block (no new issues). Not run: e2e/smoke, DB-backed flows (lock/anulación not exercised against a real DB).
- Next: manual check of two rapid runs against a dev DB; consider extending `npm run test:smoke` with MRP later.

## Review
- Native review (medium, reliability lens) approved and acknowledged 2026-10-25. Non-blocking follow-ups:
  - R3-recent-run-future-timestamp (WARNING, FIXED 2026-10-25: absolute difference; tests for boundary, small and large future skew; RED 5/1 then 15/15 mrp tests; tsc/eslint clean; not reviewed): `corridaReciente` treats a run timestamp ahead of the app clock as recent; DB/app clock or timezone skew would 409 every run. Clamp negative differences / test future and boundary timestamps.
  - R3-route-tx-untested (WARNING): lock, recent-run check and anulación filter not tested against a DB (candidate for the smoke suite).
  - R3-409-mapping-via-retry (SUGGESTION): no test that the route maps `CorridaRecienteError` to 409 (verified manually: `runWithRetry` rethrows non-deadlock errors unchanged).
  - R3-prep-stock-unit (SUGGESTION): prep stock assumed in recipe unit; no check.

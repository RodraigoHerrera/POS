# Feature: inventario-anular-entradas

## Objective
Allow an Administrator to void ("anular") a manual stock entry from the Kardex, reverting its stock and average cost while preserving full history.

## Problem / Why
Wrong entries can only be edited today. Physically deleting an entry is not viable: `auditoriaEntrada` references `movimientoInventario` and `lote` with `ON DELETE RESTRICT`, and deleting would destroy the audit trail. User chose soft void (anulación) over hard delete.

## Scope
- Schema: `movimientoInventario.anulado_en DateTime?` + migration (force-add, `*.sql` is gitignored).
- Pure rules: void eligibility = manual entry (Compra/Ajuste/Traslado), not already voided, lot has no other movements and no production consumption (same rule as quantity/cost editability).
- Tx executor: same lock order as edit (movimiento → lote → stockLoteSucursal → inventarioSucursal, FOR UPDATE, inside runWithRetry); recheck eligibility after locks; set lot stock to 0 for that branch, subtract quantity from inventarioSucursal, recompute average cost from remaining lots; set `anulado_en`; write one `auditoriaEntrada` row with `campo = "anulacion"` and optional reason in `valor_nuevo`.
- Endpoint: `POST /api/inventarios/entradas/[id]/anular` (Administrador only), optional `{ motivo }` (max 255).
- Edit endpoint rejects voided entries (409).
- Kardex API: `anulado`, `anulable` flags; voided rows have `editable = false`.
- Kardex UI: strikethrough + "Anulada" badge for voided rows; "Anular" button with in-app confirmation (no browser confirm()) and optional reason.
- Exclude voided entries anywhere entry quantities/costs are aggregated (reports), if such places exist.

## Constraints
- Strict TDD (node:test via `npx tsx --test`), no e2e.
- Error messages must not contain "deadlock", "1213", "1205".
- Plain reads only after the last FOR UPDATE (REPEATABLE READ snapshot).
- Do not touch unrelated uncommitted user changes.

## Tasks
- [x] T1 Schema field + migration
- [x] T2 Pure void rules + tests
- [x] T3 Tx executor + mocked-tx tests
- [x] T4 POST anular route + edit route rejects voided
- [x] T5 Kardex API flags + kardexEditabilidad tests
- [x] T6 Kardex UI (badge, button, confirmation)
- [x] T7 Exclude voided entries from aggregations (if any)
- [x] T8 Verification: tests, tsc, lint on new files

## Acceptance criteria
- Eligible entry voided → stock and average cost reverted, `anulado_en` set, audit row written.
- Ineligible (consumed lot / already voided / non-manual) → 409, nothing changes.
- Voided rows visible in Kardex, struck through, not editable nor voidable.

## TDD
Mode: strict (source: user global CLAUDE.md "Strict TDD Mode: enabled"). Runner: `npx tsx --test src/lib/<file>.test.ts`.

## Progress
Created 2026-10-24. T1-T7 implemented; T8 verification run (all green; only lint finding is pre-existing `catch (error: any)` in kardex/route.ts).
- T1: schema field + migration 20261024180000_add_anulacion_movimiento (*.sql gitignored, force-add). `prisma generate` wrote types but hit EPERM renaming the engine DLL (dev server lock); retry after stopping it. Migration NOT applied.
- T2/T3/T5: RED observed (module/exports missing, 9 kardex tests failing), then GREEN. Full lib suite 301/301.
- T7: only `movimientosMensuales` aggregated Compra entries; added `anulado_en IS NULL`.
- T6 is unit-untestable (no component tests); verified by tsc/eslint only.

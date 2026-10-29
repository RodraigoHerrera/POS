# Kardex: empleado_id on every movimientoInventario

## Objective
Audit who performs every inventory movement by storing `empleado_id` (FK to `empleados`) directly on `movimientoInventario` (the Kardex).

## Problem / Why
Today the Kardex records what moved but not who moved it. Stock receipts, sales, waste, production and voids cannot be traced to an employee.

## Scope
- Prisma schema + migration: nullable `empleado_id BigInt?` with relation to `empleados`, index, inverse relation on `empleados`.
- Every Kardex write path sets `empleado_id` from the authenticated session:
  - `src/app/api/inventarios/registrarEntrada/route.ts`
  - `src/lib/fefo.ts` (sales consumption, called from `caja/registrarPedido`)
  - `src/lib/mermas.ts`
  - `src/lib/produccion.ts`
  - `src/app/api/caja/anularPedido/route.ts`
  - `src/app/api/admin/ventas/[id]/anular/route.ts`
- Callers pass the session `empleadoId` down to the lib functions.

## Constraints
- Column is nullable: historical rows have no known employee; no backfill.
- Do not change unrelated behavior or the INV-3 mutation order.
- Generated artifacts in English; follow existing code style.

## TDD
- Mode: strict (source: user global CLAUDE.md "Strict TDD Mode: enabled").
- Runner: `npx tsx --test <file>.test.ts` (node:test via tsx).

## Tasks
- [x] T1 Schema + migration (`prisma migrate dev --name kardex_empleado_id`), regenerate client.
- [x] T2 Lib write paths (fefo, mermas, produccion) accept and persist `empleadoId`; tests RED→GREEN.
- [x] T3 Route write paths (registrarEntrada, anularPedido, admin anular venta, registrarPedido and callers of mermas/produccion) pass session `empleadoId`.
- [~] T4 Full unit test suite + `npx tsc --noEmit` + `npm run lint`. Tests/tsc green vs baseline; lint has 157 pre-existing errors (identical before/after), so not clean.

## Acceptance criteria
- Every `movimientoInventario.create/createMany` in `src` sets `empleado_id`.
- Migration applies cleanly; existing rows keep `empleado_id = NULL`.
- All unit tests, typecheck and lint pass.

## Progress
- Branch `feat/kardex-empleado-id` created.
- T1: migration `20261029231234_kardex_empleado_id` (column + index + FK only) applied via `migrate deploy`; client regenerated.
- T2: RED observed (4 failing in fefo/mermas/produccion tests), GREEN after impl (67/67).
- T3: all 9 write sites set `empleado_id` (+ editarPedido fefo callers, mermas route, produccion action).
- T4: full suite 562/563 pass; only `src/lib/auth.test.ts` fails (also on base: "Unable to deserialize cloned data"). tsc exit 0. Lint 157 errors before and after (pre-existing no-explicit-any).

- Independent verification: no blocking problems; fixed lowercase `movimientoinventario` in the migration's ALTER (would fail on case-sensitive MySQL); local checksum updated, `migrate status` up to date.
- Gap: no route-level tests for anular / anularPedido / registrarEntrada (e2e policy).

## Next step
Commit, push, PR.

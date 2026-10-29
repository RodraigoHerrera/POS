# Feature: caja-movimientos-efectivo

## Objective
Let the cashier record manual cash entries (Entrada) and withdrawals (Salida) on their open register, with amount and reason; persist them, include them in the expected cash, and show entry/withdrawal totals on the closing ticket.

## Problem / Why
Cash physically enters/leaves the drawer outside sales (change float top-up, supplier payment, withdrawal to safe). Today there is no way to record it, so the close shows a false Sobrante/Faltante.

## Existing state (verified 2026-10-28)
- `movimientoCaja` model exists (`tipo` VarChar "INGRESO"/"EGRESO", `monto`, `descripcion`, `creado_en`). It is ALREADY written automatically:
  - `src/app/api/caja/facturacion/route.ts`: INGRESO per cash sale ("Venta Pedido #N - Efectivo").
  - `src/app/api/admin/ventas/[id]/anular/route.ts`: EGRESO when a cash sale is voided while its caja is open ("Devolución Anulación Pedido #N").
- `calcularResumenCaja` (`src/lib/caja.ts`): `efectivoEsperado = saldo_inicial + ventas_efectivo` (sales from PAGADO invoices; voided orders already drop out). Movements are ignored today.
- `caja.entradas_efectivo` / `caja.salidas_efectivo` columns exist (Decimal, default 0), never written.

## Decisions
- D1 Discriminator: new enum `OrigenMovimientoCaja { VENTA ANULACION MANUAL }`, column `movimientoCaja.origen` NOT NULL. Migration backfills existing rows (`descripcion LIKE 'Devolución Anulación%'` => ANULACION, rest => VENTA) and keeps no DB default; both existing writers set `origen` explicitly. Only MANUAL rows count as cash entries/withdrawals (counting VENTA/ANULACION would double count sales).
- D2 `efectivoEsperado = saldo_inicial + ventas_efectivo + entradas_manuales - salidas_manuales` (Prisma.Decimal). `ResumenCaja` exposes `entradasEfectivo`, `salidasEfectivo`.
- D3 A Salida cannot exceed the current expected cash in the drawer (400 with clear message).
- D4 Movements are immutable (no edit/delete) — audit trail. Out of scope.
- D5 Reason required: trimmed, 3–200 chars. Amount > 0, max 2 decimals. Manual `tipo` stored as existing "INGRESO"/"EGRESO".
- D6 UI: button "Movimiento de caja" in `TopBarCajero` (optional prop, like `onVerPedidos`) on `/cajero/ventas` and `/cajero/pedidos`; opens a modal: Entrada/Salida toggle, amount (Bs prefix), reason, confirm; below, the shift's manual movements list (time, type, amount, reason) with totals. Visual language of `metodos-pago`.
- D7 Close: `/api/caja/cerrar` persists `entradas_efectivo` / `salidas_efectivo` and returns them; cierre live summary shows them in the cash breakdown; ticket shows "Entradas de efectivo" and "Salidas de efectivo" totals.

## Scope / Tasks
- [x] T1 Schema + migration (enum, `origen`, backfill); existing writers set `origen`. Verify with `prisma migrate diff` and apply to dev DB.
- [x] T2 Pure validation `validarMovimientoCaja` (new `src/lib/movimientoCaja.ts`) + tests (RED -> GREEN)
- [x] T3 `calcularResumenCaja` includes manual movements (D2) + tests (RED -> GREEN)
- [x] T4 API: `POST /api/caja/movimiento` (Cajero/Administrador, open caja of the employee, D3), `GET /api/caja/movimientos` (manual movements of the open caja + totals). Validation before DB access.
- [x] T5 UI: TopBarCajero button + modal; wired on ventas and pedidos.
- [x] T6 Close + ticket: persist/return totals; `ticketCierre.ts` + tests (RED -> GREEN); `TicketCierreCaja.tsx`; cierre page summary.
- [x] T7 Smoke spec: record Entrada and Salida before closing; assert ticket totals and DB rows. Checks: unit, tsc, eslint.
- [ ] T8 Smoke run + visual capture (parent).

## Constraints
- Strict TDD, runner `npx tsx --test <file>`. Smoke on demand (needs :3000 dev server stopped). Migration SQL must be committed (`git show --stat` check; `.gitignore` has a migrations exception).
- UI copy Spanish.

## Acceptance criteria
- Cashier records Entrada/Salida with amount and reason on the open caja; stored as MANUAL `movimientoCaja` rows.
- Expected cash at close includes them; the close with a correct count is Exacta.
- Ticket shows Entradas/Salidas de efectivo totals; `caja.entradas_efectivo` / `salidas_efectivo` persisted.
- Invalid amount/reason or Salida above drawer cash => 400, nothing written.

## TDD
- Mode: enabled (session config "Strict TDD Mode: enabled"); runner: `npx tsx --test`.

## Progress
- Created 2026-10-28.
- T1-T7 implemented on branch feat/caja-movimientos-efectivo (uncommitted). T8 pending (parent).

## Verification evidence
- T1: `prisma migrate diff` (pre-SQL) printed ADD COLUMN origen ENUM(...) NOT NULL + CREATE INDEX movimientoCaja_caja_id_origen_idx; hand-written migration matches plus backfill UPDATE. `prisma migrate deploy`: applied 20261028140000_add_origen_movimiento_caja. Post diff: "This is an empty migration." `git check-ignore -v` matches the `!prisma/migrations/**/migration.sql` negation (not ignored). `prisma generate` hit EPERM renaming query_engine dll (a running process locks it); TS client types ARE regenerated (OrigenMovimientoCaja present); re-run generate once the dev server is stopped.
- T2 RED: `npx tsx --test src/lib/movimientoCaja.test.ts` failed (module missing); GREEN: 12/12 pass.
- T3 RED: 2 new caja.test.ts tests failed (24/26); GREEN: 26/26.
- T6 RED: 2 new ticketCierre tests failed (10/12); GREEN: 12/12.
- `npx tsx --test` movimientoCaja + caja + ticketCierre + conteoCierre: 66 pass / 0 fail.
- `npx tsc --noEmit`: clean. eslint: only pre-existing no-explicit-any (caja.ts, caja.test.ts:309, ventas/pedidos pages).
- T7 spec written, not run.

## Next step
- T8: parent runs smoke + visual capture (stop dev server on :3000 first; then `npx prisma generate`).

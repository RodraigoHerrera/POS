# Feature: caja-conciliacion-electronica

## Objective
At register close, the cashier declares the totals received by Tarjeta (POS batch / vouchers) and QR (bank/wallet receipts) next to the cash count. The system reconciles them against recorded sales, persists the differences and shows a per-method reconciliation on the closing ticket.

## Problem / Why
Today the close only audits physical cash (`diferencia_efectivo`). Electronic payments are never reconciled, although `caja.diferencia_tarjeta` and `caja.diferencia_qr` already exist in the schema.

## Scope
- Pure helper in `src/lib/caja.ts`: compute `declarado - esperado` with `Prisma.Decimal`, 2 decimals, residue < 0.005 => 0 (same rule as today's cash). Route reuses it for efectivo, tarjeta and QR.
- `POST /api/caja/cerrar`: payload adds `totalTarjeta` and `totalQr` (required, validated fail-fast with `parseNonNegativeNumber`). Persist `diferencia_tarjeta` / `diferencia_qr`. Response keeps existing fields and adds expected, declared and difference for tarjeta and QR.
- `cierre/page.tsx`: numeric inputs for Tarjeta and QR beside the cash count; reject negatives / invalid characters before submit.
- `ticketCierre.ts` + `TicketCierreCaja.tsx`: reconciliation section with one row per audited method (Efectivo, Tarjeta, QR): Esperado (Sistema), Declarado (Manual), Diferencia with Exacta / Sobrante / Faltante.
- Out of scope: schema migration (columns exist), transferencia/giftcard/otros reconciliation, reprinting past closings.

## Constraints
- Strict TDD, runner `npx tsx --test <file>`. No e2e per change; smoke spec only updated, run on demand on test DB.
- UI copy in Spanish (existing project language). Do not touch unrelated uncommitted changes (`.atl/*`, `skills-lock.json`, `security-audit` skill dirs).

## Tasks
- [x] T1 Pure difference helper in `caja.ts` + tests in `caja.test.ts` (RED -> GREEN)
- [x] T2 `/api/caja/cerrar`: payload, validation, persistence, response
- [x] T3 `ticketCierre.ts` reconciliation model + tests in `ticketCierre.test.ts` (RED -> GREEN)
- [x] T4 `TicketCierreCaja.tsx` reconciliation section; `cierre/page.tsx` inputs + validation
- [x] T5 `tests/smoke/caja-cierre.spec.ts` sends and asserts new fields
- [x] T6 Verification: unit tests, `npx tsc --noEmit`, eslint on touched files

## Acceptance criteria
- Declared tarjeta/QR negative or non-numeric => 400 before any DB access.
- `diferencia_tarjeta` / `diferencia_qr` persisted with Decimal precision.
- Response includes esperado, declarado, diferencia for tarjeta and QR.
- Ticket shows Efectivo, Tarjeta and QR rows with Esperado / Declarado / Diferencia + status.

## TDD
- Mode: enabled (session config "Strict TDD Mode: enabled"); runner: `npx tsx --test`.

## Progress
- Created 2026-10-28.
- T1-T6 implemented 2026-10-28. Files: `src/lib/caja.ts` (+`calcularDiferenciaConciliacion`), `src/lib/caja.test.ts`, `src/app/api/caja/cerrar/route.ts`, `src/lib/ticketCierre.ts`, `src/lib/ticketCierre.test.ts`, `src/components/caja/TicketCierreCaja.tsx`, `src/app/(usuario)/cajero/cierre/page.tsx`, `tests/smoke/caja-cierre.spec.ts`, `tests/e2e/helpers.ts` (`cerrarCaja` takes optional `{tarjeta, qr}`, default 0, fills `#total-tarjeta`/`#total-qr`; needed so `demo.spec.ts` keeps working).
- T2 and T4 have no unit tests (route/UI need DB/browser); covered only by tsc + the (unrun) smoke spec.

## Verification evidence
- T1 RED: `npx tsx --test src/lib/caja.test.ts`: 24 tests, 18 pass, 6 fail (`calcularDiferenciaConciliacion is not a function`). GREEN: 24/24 pass.
- T3 RED: `npx tsx --test src/lib/ticketCierre.test.ts`: 9 tests, 7 pass, 2 fail (`conciliacion` undefined). GREEN: 9/9 pass.
- `npx tsx --test src/lib/caja.test.ts src/lib/ticketCierre.test.ts`: 33 tests, 33 pass, 0 fail.
- `npx tsc --noEmit`: no output (clean).
- `npx eslint <touched files>`: 4 errors + 1 warning, all pre-existing: `no-explicit-any` at caja.ts:111,116 (`items?: any[]`) and caja.test.ts:307; cierre/page.tsx unused `_detalle` and `any` in catch. None in new code.
- Smoke spec updated, NOT run (policy: on demand, separate test DB).

## Changes after delivery
- 2026-10-28: user asked to remove the old cash rows from the ticket ("Efectivo esperado", "Caja cerrada con", standalone difference) since cash now lives in the reconciliation section. "Caja abierta con" (opening balance) kept: not duplicated. Removed `efectivoEsperado`, `totalContado`, `diferencia` from `TicketCierre` (input `CierreCajaData` unchanged). TDD: RED `npx tsx --test src/lib/ticketCierre.test.ts` 10 tests, 9 pass, 1 fail; GREEN with caja tests 34/34. `npx tsc --noEmit` clean. Smoke spec assertions updated accordingly.

## Smoke run (2026-10-28) — NOT passing, environmental
- `npm run test:smoke` x3 against `smash_test`. Run 1-2: `Timed out waiting 180000ms from config.webServer`. Manual probe: smoke `next dev` needs ~33s to start and ~112s to compile `/` while the user's dev server on :3000 is running.
- Run 3 (warm `.next-smoke` cache): server started, both specs (caja-cierre and the untouched dashboard-periodo) timed out at login navigation (`page.waitForURL` 120s in `tests/e2e/helpers.ts:75/78`) — on-demand route compilation, before reaching any changed code.

## Next step
- Rerun `npm run test:smoke` with the :3000 dev server stopped.

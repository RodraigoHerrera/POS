# Feature: caja-ticket-cierre

## Objective
When a cashier closes the register, show a printable "Cierre de Caja" receipt (80mm, comanda-style) summarizing the shift.

## Problem / Why
`/cajero/cierre` only shows a card with the cash difference after closing. The user wants a printable summary with opening/closing dates, sales per payment method, opening cash, counted cash and difference.

## Scope
- `POST /api/caja/cerrar` response adds (backward compatible): `fechaApertura`, `fechaCierre`, `saldoInicial`, `empleadoNombre`, `cajaId` (already there). The cookie `tokenCaja` is cleared on close, so the receipt is rendered from this response, not from a separate authenticated page.
- Pure helper `src/lib/ticketCierre.ts`: builds the receipt view model from the close response — ordered payment-method lines (Efectivo, Tarjeta, QR, Transferencia, Gift Card, Otros), total ventas, saldo inicial ("Caja abierta con"), efectivo esperado, total contado ("Caja cerrada con"), diferencia with label Exacta / Sobrante / Faltante (|diff| < 0.01 = exacta), formatted "Bs 0.00" amounts.
- UI: replace the post-close card in `src/app/(usuario)/cajero/cierre/page.tsx` with a receipt component (e.g. `src/components/caja/TicketCierreCaja.tsx`) styled like `src/app/(usuario)/cajero/comanda/[id]/page.tsx` (font-mono, max-w-[80mm], print: classes). Buttons "Imprimir" (window.print) and "Salir" (existing handleSalir) hidden on print. Header "SMASH POS" / "Cierre de Caja", caja #, cajero, fecha apertura, fecha cierre, payment lines, totals, difference, footer "-- Fin de Cierre --".
- Out of scope: reprinting past closings, admin history view, movimientoCaja entries/exits (not part of efectivoEsperado today).

## Constraints
- Strict TDD with node:test (`npx tsx --test <file>`), no e2e.
- UI copy in Spanish; dates with `toLocaleString("es-MX")` like the comanda.
- Do not touch unrelated uncommitted user changes.

## Tasks
- [x] T1 `ticketCierre.ts` pure view-model + tests (RED → GREEN)
- [x] T2 `/api/caja/cerrar` returns the extra fields
- [x] T3 Receipt component + wire into cierre page with print/salir buttons
- [x] T4 Verification: unit tests, tsc, lint on touched files

## Acceptance criteria
- After "Confirmar Cierre", the receipt shows opening/closing date-time, sales per method, total, opening cash, counted cash, expected cash and difference (Sobrante/Faltante/Exacta).
- "Imprimir" prints only the receipt.
- Existing close behavior (DB update, cookie clearing) unchanged.

## TDD
- Mode: enabled (session config "Strict TDD Mode: enabled"); runner: `npx tsx --test`.

## Progress
- Created 2026-10-24. T1-T4 done 2026-10-24.

## Verification evidence
- RED: `npx tsx --test src/lib/ticketCierre.test.ts` failed (module ./ticketCierre not found) before implementation.
- GREEN: same command, 7 tests pass, 0 fail.
- `npx tsx --test src/lib/caja.test.ts`: 18 pass, 0 fail.
- `npx tsc --noEmit`: no errors.
- `npx eslint` on touched files: 0 new issues; 2 pre-existing in cierre/page.tsx (unused `_detalle` warning, `any` in catch).
- Not verified: visual print layout in a browser (no e2e by policy).

## Review
- Unrelated workspace changes stashed first (`stash@{0}`: "wip: cambios no relacionados (antes de review caja-ticket-cierre)").
- Native review (1 lens, reliability) approved and acknowledged; authority burned. Non-blocking follow-ups:
  - R3-post-commit-lookup (WARNING): FIXED 2026-10-24 — lookup moved before `caja.update` (parallel with `calcularResumenCaja`) with `.catch(() => null)` fallback. Checks: tsc clean, eslint clean on route, 25/25 unit tests. No route-level test (no route test harness in repo); this fix happened after the approved review, so it was not reviewed.
  - R3-route-contract-untested (WARNING): no test for the new response fields of `/api/caja/cerrar`.
  - R3-invalid-date-fallback-untested (SUGGESTION): `formatearFecha` / empty cashier fallbacks untested; could move into `ticketCierre.ts`.

## Changes after review
- 2026-10-24: user asked to remove observaciones from the receipt. Removed from ticket view model, component and close response (the cashier textarea and DB field stay). TDD: test changed first (RED 6/1), then GREEN 25/25 with caja tests; tsc and eslint clean. Not re-reviewed.

## Next step
- Manual check: close a caja, press Imprimir, confirm only the receipt prints.

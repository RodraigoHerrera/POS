# Fix app findings from the TestSprite run

## Objective
Fix the three application bugs found by the TestSprite suite (report `testsprite_tests/testsprite-mcp-test-report.md`, run 3).

## Problem / Why
1. Register opening loop: a 409 "Ya tienes una caja abierta" from `/api/caja/apertura` is shown as an error and the cashier stays on "Apertura de Caja"; every retry repeats it (TC006, TC007, TC015).
2. `src/app/api/caja/apertura/route.ts` logs the register JWT (`console.log("Token generado:", cajaToken)`) — anyone with log access can reuse it.
3. `POST /api/auth/registerAdmin` returns 500 on a duplicate username (`P2002 empleados_usuario_key`) instead of a clear 409.

## Scope
- `src/app/(usuario)/cajero/page.tsx` + small pure helper for the post-apertura decision.
- `src/app/api/caja/apertura/route.ts`: drop the token log.
- `src/lib/altaEmpleado.ts`: reject duplicate `usuario` with 409 (pre-check) and map a racing `P2002` to 409.

## Constraints
- 409 means the current employee already has an open register in this branch (query is by sucursal + empleado), so continuing to `/cajero/ventas` is correct. `tokenCaja` is not read by any route.

## TDD
- Mode: strict (source: user global CLAUDE.md). Runner: `npx tsx --test <file>.test.ts`.

## Tasks
- [x] T1 Apertura 409 continues to sales (helper + test).
- [x] T2 Remove JWT log in apertura route.
- [x] T3 Duplicate username returns 409 in altaEmpleadoAtomica (tests).
- [x] T4 Full unit suite, tsc, lint.

## Progress
- RED: `aperturaCaja.test.ts` (module missing) and 2 of 5 `altaEmpleado.test.ts` cases failed. GREEN: 8/8.
- Full suite 590/591; the only failure is `auth.test.ts` in the parallel run ("Unable to deserialize cloned data"), which passes 34/34 alone with and without these changes (pre-existing flake). `tsc --noEmit` clean. Lint: only the pre-existing `catch (error: any)` in `cajero/page.tsx`.
- Not verified in a browser; the next TestSprite run should confirm TC006/TC007/TC015.

## Acceptance criteria
- 409 on apertura navigates to `/cajero/ventas`; other errors still alert.
- No token or secret is logged by the apertura route.
- Duplicate username (pre-check or concurrent P2002) returns 409 with a clear message.

## Next step
Done. Optional: re-run TestSprite to confirm the register flow.

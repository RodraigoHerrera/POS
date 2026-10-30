# Auto-generated lot code on inventory entries

## Objective
An inventory entry without a lot code always saves, with an automatically generated code; a real duplicate code returns a clear 409 instead of 500.

## Problem / Why
TestSprite TC038 (run 4): `POST /api/inventarios/registrarEntrada` returned 500 with `P2002 lote_item_id_codigo_lote_key`. The "Lote" field in `EntradaModal` is optional and arrives as `""`; lot codes are unique per item across all branches, so only the first blank-code entry per item ever succeeds. A missing (`undefined`) code also fails.

## Decision (user, 2026-10-30)
When no lot code is given, generate one automatically.

## Scope
- Pure helper `src/lib/codigoLote.ts`: resolve the code (trim; blank/missing → `L-YYYYMMDD-XXXXXX`, random base36) and detect a duplicate-lot `P2002`.
- `registrarEntrada` route uses it; duplicate → 409 "Ya existe un lote con ese código para este item".
- `EntradaModal` placeholder tells the user the code is generated if left empty.

## TDD
- Mode: strict (source: user global CLAUDE.md). Runner: `npx tsx --test <file>.test.ts`.

## Tasks
- [x] T1 `codigoLote.ts` + tests (RED → GREEN).
- [x] T2 Route + modal wiring.
- [x] T3 Unit suite, tsc, lint.

## Progress
- RED: `codigoLote.test.ts` failed (module missing). GREEN: 8/8.
- Route: code resolved with the business time zone (`obtenerZonaMrp`, default America/La_Paz); duplicate `P2002` on the lot index → 409. `runWithRetry` rethrows the original error, so detection works.
- Full unit suite 616/616, `tsc --noEmit` clean, lint: only the 3 pre-existing `any` in `EntradaModal`.
- Not verified in a browser; TestSprite TC038 should confirm.

## Next step
Done.

## Acceptance criteria
- Blank, whitespace-only or missing code → generated code, entry saved.
- Given code is trimmed and kept.
- Duplicate code → 409 with a clear message.

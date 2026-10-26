# Tasks: inventario-entrada-unidad (show item unit in "Registrar entrada")

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~110-150 (helpers ~30, tests ~70, modal ~20) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending (not needed) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Strict TDD: enabled. Runner: `npx tsx --test` (node:test + node:assert/strict). No Playwright e2e.

## Phase 1: RED - failing tests (src/lib/unidad.test.ts)

- [x] 1.1 Create `src/lib/unidad.test.ts` with `labelUnidad` cases (S11, S1-S4): "kg"->"kg"; " kg "->"kg"; " l "->"l"; ""->"u"; "   "->"u"; null->"u"; undefined->"u". Run `npx tsx --test src/lib/unidad.test.ts`; observe RED (module missing).
- [x] 1.2 In the same test file add `hintUnidad(itemId, unidades)` cases: empty itemId "" -> undefined (S5); unknown id absent from lookup -> undefined (S6, S8 empty lookup); prototype-key ids "toString"/"constructor" -> undefined (own-key check); known id with "kg" -> "Unidad: kg" (S1/S7); known id with "" -> "Unidad: u" (S2); known id with "   " -> "Unidad: u" (S3); known id with " l " -> "Unidad: l" (S4); switching id between two lookup entries yields each unit (S9). Observe RED.

## Phase 2: GREEN - minimal implementation (src/lib/unidad.ts)

- [x] 2.1 Create `src/lib/unidad.ts` exporting `UNIDAD_FALLBACK = "u"` and `labelUnidad(code?: string | null): string` (trim, fallback "u"). Run focused tests; labelUnidad cases GREEN.
- [x] 2.2 In `src/lib/unidad.ts` add `hintUnidad(itemId: string, unidades: Record<string, string>): string | undefined`: returns undefined when `itemId === ""` or `!Object.hasOwn(unidades, itemId)`; else `` `Unidad: ${labelUnidad(unidades[itemId])}` ``. Run focused tests; all GREEN.

## Phase 3: REFACTOR

- [x] 3.1 Tidy `src/lib/unidad.ts` / `src/lib/unidad.test.ts` (JSDoc one-liners, shared test fixtures, no behavior change); re-run `npx tsx --test src/lib/unidad.test.ts` and stay GREEN.

## Phase 4: Modal wiring (src/components/inventario/modals/EntradaModal.tsx)

- [x] 4.1 Import `hintUnidad` from `@/lib/unidad` (match the file's existing import alias style) and add `const [unidades, setUnidades] = useState<Record<string, string>>({})`.
- [x] 4.2 In `fetchData` (around L60-71), from the same filtered `itemsData` (tipo != "vendible") call `setUnidades(...)` mapping `i.id.toString()` -> `i.unidad_code ?? ""` next to `setItemsOptions`; no new fetch, no API change (R1, R4, R6).
- [x] 4.3 Derive during render `const hintCantidad = hintUnidad(payload.item, unidades)` (no useEffect/derived state) and pass `hint={hintCantidad}` to the Cantidad `Input` (around L210-215), without `error`/`success` props (R1-R5).

## Phase 5: Static verification

- [x] 5.1 Run `npx tsc --noEmit`; no new errors.
- [x] 5.2 Run `npm run lint`; no new warnings/errors in touched files.
- [x] 5.3 Manual review against S1-S10 (read-only code check; no Playwright e2e): confirm no hint for empty/unknown selection, preset shows hint after load, change/clear updates hint; confirm `registrarEntrada`, Prisma schema and API untouched via `git diff --stat`.

## Spec coverage
R1/R2/S1-S4: 1.1, 1.2, 2.1, 2.2, 4.3. R3/S5-S6/S8: 1.2, 2.2, 4.3. R4/S7: 4.2. R5/S9-S10: 1.2, 4.3. R6: 4.2, 4.3, 5.x.

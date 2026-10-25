# Feature: mrp-auditoria-media

## Objective
Close the remaining actionable MRP audit findings (MEDIUM + review follow-ups) that need no schema change and no new product semantics.

## Problem / Why
The 2026-10-25 MRP audit (Engram `pos/mrp/audit`) left MEDIUM findings and review follow-ups after the HIGH fixes in `fix/mrp-compras-duplicadas`. User asked (2026-10-25) to finish the whole flow without further commit/push prompts.

## Decisions (taken by the orchestrator, conservative; documented here)
- Timezone: bucket sales and iterate days in one business timezone, configurable via env `MRP_TZ`, default `America/La_Paz` (UTC−4, no DST; currency Bs). Use the same function for keying and iteration.
- Small forecasts: do not drop them. Explode with the fractional horizon quantity (or `Math.ceil` if the MPS column is integer) instead of `Math.round`; keep UI/persisted values consistent.
- Lot rounding: order quantities for items whose unit is counted in whole units (check `unidad_code` values in schema/seed, e.g. "u"/"und") are rounded up to integers; other units keep 3 decimals.
- Validation: `horizonteDias` must be an integer in [1, 60] → 400 otherwise; non-numeric `[id]` → 400 (not 500).
- History query: replace the unbounded 60-day `findMany` with an aggregated query (`groupBy` by product and day, or raw SQL aggregated by business-timezone date).
- 409 mapping: extract the error→response mapping of `/api/mrp/ejecutar` into a pure tested helper.
- Prep stock unit: verify that prep stock (`inventarioSucursal.stock`) and recipe quantities share `item.unidad_code`; document the invariant in code; add a warning if a unit mismatch is detectable.
- Merma 100%: warn instead of silently using ×100.

## Out of scope (need product decisions — listed for the user)
- Persisting historical run metadata (proveedor, method, warnings) and the OC suggested date → schema change.
- Shelf-life cap semantics, lead-time/emission-date semantics, safety-stock formula.
- Extras/modifiers consumption in sales history.

## Constraints
- Strict TDD (node:test, `npx tsx --test`); no e2e per change.
- No schema change. Don't touch unrelated user WIP.

## Tasks
- [x] T1 Business-timezone date keying (zonaHoraria.ts + forecast.ts + data.ts) + tests (RED: module missing; GREEN 7/7, also under TZ=Asia/Tokyo)
- [x] T2 Keep small forecasts: `cantidadMps` (3 decimals) replaces Math.round + tests (RED: export missing; GREEN)
- [x] T3 Whole-unit rounding of order quantities (`cantidadOrden`/`esUnidadEntera` in ordenes.ts) + tests (RED; GREEN)
- [x] T4 Input validation 400s via `parseHorizonteDias` / `parseCorridaId` (validacion.ts) + tests (RED; GREEN)
- [x] T5 Aggregated history query (`$queryRaw` grouped by producto + local day) + pure `agruparFilasVentas` tested (RED; GREEN). SQL itself not executed (no DB access in this batch).
- [x] T6 Pure error mapping `respuestaDeError` (409/400/500) + tests (RED; GREEN)
- [x] T7 Prep unit invariant documented; merma >= 100% warning; prep names in messages + tests (RED; GREEN)
- [x] T8 Verification (below)

## Acceptance criteria
- A 21:00 local sale is bucketed on its local day.
- A product with horizon forecast 0.4 still reaches the explosion.
- OCs for whole-unit items have integer quantities.
- Invalid inputs return 400; recent-run returns 409; both tested via pure helpers.

## TDD
- Mode: enabled; runner `npx tsx --test`.

## Decisions refined during implementation
- `mrpForecastDetalle.mps_qty` and `cantidad_pronosticada` are Decimal(18,3): no ceil needed; MPS keeps the fraction rounded to 3 decimals.
- History SQL shifts `fecha_venta` by a numeric offset in seconds (derived from MRP_TZ at "now") instead of CONVERT_TZ, so MySQL tz tables are not required. Exact for zones without DST (La Paz); approximate across a DST change elsewhere.
- Whole-unit codes: u, und, unid, unidad(es), caja(s), paquete(s), pza, pieza(s) (case-insensitive). Seed uses "u"/"kg"; UI catalog uses unidad/caja/paquete/litro/kilogramo/gramo/mililitro.
- Unit invariant: recetaItem has no unit field; stock and recipe quantities are both implicitly in item.unidad_code, so a mismatch is NOT detectable from data. Documented in explosion.ts only (no warning possible).
- Merma >= 100%: clamp to 0.01 kept (avoids division by zero) but now emits an advertencia per receta/insumo.
- `corridas/route.ts` only had the `catch (error: any)` fixed (`unknown`); `[id]` route uses `respuestaDeError`.
- Persisted `necesidad_neta` stays unrounded; only the OC line quantity (and total) is rounded up.
- Honest TDD note: `inicioDiaLocal` test and impl were added in the same step (no separate RED observed); everything else had observed RED first.

## Verification evidence (2026-10-25)
- `npx tsx --test src/lib/mrp/*.test.ts`: 44 tests, 44 pass, 0 fail (RED before implementation: 13 failing + 3 missing-module files).
- `npx tsx --test tests/unit/forecast.test.ts tests/unit/interactive-forecast.test.ts`: 2/2 pass.
- `npx tsc --noEmit`: exit 0.
- `npx eslint src/lib/mrp src/app/api/mrp`: exit 0.
- Not run (by instruction): e2e/smoke, DB seeds, the new raw SQL against MySQL.

## Progress
- Created 2026-10-25 on branch `fix/mrp-auditoria-media` (stacked on `fix/mrp-compras-duplicadas`). T1-T8 done, uncommitted.

## Review
- Native review (medium, reliability lens) approved and acknowledged 2026-10-25.
  - R3-raw-sql-unexecuted (WARNING): addressed before commit — orchestrator ran `obtenerVentasDiariasPorProducto` read-only (SELECT) against the dev DB: 1 product, 60 days, total 542 = same total as the previous Prisma aggregate; table `historialVentas` has no @@map; `GROUP BY dia` works under the server's sql_mode.
  - R3-ceil-epsilon-zero (SUGGESTION): `cantidadOrden` can yield 0 for a positive need <= 1e-9 on whole-unit items.
  - R3-merma-dedupe-key (SUGGESTION): merma warning dedupe key ignores the parent recipe.

## Next step
- Manual smoke of `POST /api/mrp/ejecutar` against a dev DB to confirm the `INTERVAL ? SECOND` raw query and `GROUP BY dia` alias under the server's sql_mode; then commit (conventional commits) and open PR.

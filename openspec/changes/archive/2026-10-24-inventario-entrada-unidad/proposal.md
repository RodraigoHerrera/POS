# Proposal: Show selected item unit in "Registrar entrada" modal

## Intent
When recording an inventory entry, operators type a Cantidad without seeing which unit it is measured in (kg, l, u, etc.). This causes quantity errors. The unit (`item.unidad_code`) is already returned by `GET /api/inventarios/items` but `EntradaModal` discards it when mapping items to Select options. Success: once an item is selected (manually or via `presetItemId`), the modal shows a text with that item's unit next to the Cantidad field.

## Scope

### In Scope
- New pure helper `labelUnidad(code)` in `src/lib/unidad.ts`: returns trimmed code, or `"u"` fallback for null/undefined/empty/whitespace (precedent: MermasModal.tsx:44 `unidad_code || "u"`).
- Unit tests for the helper with `node:test` + `node:assert/strict` (Strict TDD: RED -> GREEN -> REFACTOR).
- `EntradaModal.tsx`: keep an id -> unidad_code lookup built from the existing items fetch (L60-63 mapper), derive the selected item's unit during render from `payload.item`, and pass `hint={`Unidad: ${...}`}` to the Cantidad `Input` (L208-216). No hint when no item is selected.
- Works for the `presetItemId` flow (StockAlertsCard "Reponer") without extra code, since it sets `payload.item`.

### Out of Scope
- API, Prisma schema, or `registrarEntrada` changes.
- Existing `save()` bug (ignores `res.ok`) and `any` types in the fetch mappers.
- Unit enum/label translation (unidad_code is free text, VarChar(16)).
- Other modals (Salida, Mermas, etc.).
- Component test infrastructure (no RTL/vitest) and any Playwright e2e.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `inventario-entrada`: the entry modal must display the selected item's unit (fallback "u") beside the quantity input; no unit text when no item is selected.

## Approach
1. TDD the helper `labelUnidad(code: string | null | undefined): string` in `src/lib/unidad.ts` with tests in the existing `node:test` lib-test style.
2. In `EntradaModal`, store units as `Record<string, string>` state populated in the same `fetchData` pass that builds `itemsOptions`; no new fetch.
3. Derive the selected unit during render instead of syncing another state via effect (vercel-react-best-practices: derive state during render, avoid effect-synced state).
4. Render via the existing `hint` prop of `InputField` (L20, L77). UI copy in Spanish: `Unidad: {unidad}`.
5. Verify modal wiring with `tsc --noEmit` and lint; helper via `npx tsx --test`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/unidad.ts` | New | `labelUnidad` pure helper |
| `src/lib/unidad.test.ts` | New | node:test unit tests |
| `src/components/inventario/modals/EntradaModal.tsx` | Modified | Keep unidad per item id; hint on Cantidad input |

Estimated size: well under 400 changed lines; 400-line budget risk: Low.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `hint` styling (InputField hint may be styled as error/success color) looks off | Low | Verified in design: neutral `text-gray-500` by default |
| Preset item not in filtered list (tipo "vendible") | Low | No hint shown (spec R3b); matches Select behavior |
| Modal wiring not unit-tested (no component test infra) | Med | Keep logic in tested helper; modal change is a thin derivation, checked by tsc + lint |

## Rollback Plan
Revert the single commit: delete `src/lib/unidad.ts` and its test, restore `EntradaModal.tsx`. No data, API, or schema changes.

## Dependencies
- None (data already returned by `/api/inventarios/items`).

## Success Criteria
- [ ] Selecting an item in "Registrar entrada" shows `Unidad: <unidad_code>` under Cantidad.
- [ ] Item with empty/whitespace unit shows `Unidad: u`.
- [ ] No unit text before an item is selected.
- [ ] Opening via "Reponer" (presetItemId) shows the preset item's unit.
- [ ] Helper tests pass, `tsc --noEmit` and lint clean; no API/schema diff.

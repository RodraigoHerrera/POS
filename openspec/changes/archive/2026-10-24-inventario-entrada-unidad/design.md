# Design: Show selected item unit in "Registrar entrada" modal

Revision 2: aligned with spec — no hint when `payload.item` is empty OR its id is absent from the loaded unit lookup.

## Technical Approach
Client-only change. A pure helper `labelUnidad` in `src/lib/unidad.ts` normalizes the unit code (trim, fallback "u"). `EntradaModal` keeps an id -> raw `unidad_code` lookup, filled in the same `fetchData` pass that builds `itemsOptions` (no new fetch). The hint is derived during render: shown only when the selected id is an own key of the lookup; the "u" fallback applies only to known items whose `unidad_code` is empty/whitespace. No API, Prisma, or `registrarEntrada` changes.

## Architecture Decisions

### Decision: Pure helper in src/lib
**Choice**: `export function labelUnidad(code?: string | null): string` in `src/lib/unidad.ts`; returns `code.trim()` when non-empty, else `"u"`.
**Alternatives considered**: Inline `unidad_code || "u"` (MermasModal.tsx:44 precedent).
**Rationale**: No component test infra; a pure function is the only unit-testable seam under Strict TDD. Also handles whitespace, which `||` does not. MermasModal unchanged (out of scope).

### Decision: Separate `Record<string, string>` state for units
**Choice**: `const [unidades, setUnidades] = useState<Record<string, string>>({})`, built from the same filtered `itemsData` (key `i.id.toString()`, value `i.unidad_code ?? ""`), set next to `setItemsOptions`. Only non-"vendible" items enter the lookup.
**Alternatives considered**: (a) Extend `Option` with `unidad` — couples display data to the Select contract. (b) `Map` — less idiomatic for React state. (c) `itemsOptions.find(...)` — O(n) per render.
**Rationale**: O(1) lookup, no change to `Option`/`Select`; raw value stored, normalized at the edge by the tested helper. Storing `""` (not omitting) for empty codes keeps "known item, empty unit" distinguishable from "unknown item".

### Decision: Derive hint during render with a membership check (spec-aligned)
**Choice**: pure `hintUnidad(itemId, unidades)` in `src/lib/unidad.ts`:
```ts
// returns undefined when itemId === "" or !Object.hasOwn(unidades, itemId)
// else `Unidad: ${labelUnidad(unidades[itemId])}`
```
**Alternatives considered**: (a) `useEffect` syncing `unidadSeleccionada` state — rejected (`rerender-derived-state-no-effect`). (b) `payload.item in unidades` — rejected: `in` walks the prototype. (c) Showing "Unidad: u" for any selected id (revision 1) — rejected: violates spec.
**Rationale**: Spec requires no hint for: no selection; before items load; preset id filtered out as "vendible" or otherwise missing. Known items with empty/whitespace unit still show "Unidad: u".

### Decision: Use InputField `hint` in neutral state
**Choice**: Pass only `hint`; do not pass `error`/`success`.
**Rationale**: Verified InputField.tsx L77-89: hint renders `text-gray-500` when `error`/`success` are false (defaults).

### Decision: No reset logic added
**Choice**: No close/reset handling. `unidades` is overwritten on each open fetch; hint follows `payload.item` and lookup membership.

## Data Flow

    GET /api/inventarios/items ──> fetchData (filter tipo != "vendible")
          │                              ├─> setItemsOptions([{value,label}])
          │                              └─> setUnidades({ [id]: unidad_code ?? "" })
    Select onChange / presetItemId ──> payload.item
    render: hintUnidad(payload.item, unidades) ──> Input hint

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/unidad.ts` | Create | `labelUnidad`, `hintUnidad` |
| `src/lib/unidad.test.ts` | Create | node:test + node:assert/strict tests |
| `src/components/inventario/modals/EntradaModal.tsx` | Modify | `unidades` state, populate in fetchData, `hint` on Cantidad Input |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | labelUnidad + hintUnidad cases | `npx tsx --test src/lib/unidad.test.ts`. Strict TDD RED -> GREEN -> REFACTOR |
| Static | Modal wiring | `npx tsc --noEmit`, `npm run lint` |
| E2E | None | Playwright e2e excluded by user rule |

## Risks
- Modal wiring is not unit-tested (no component test infra); covered by tsc + lint + manual check.
- Preset item filtered out as "vendible" shows no hint (spec-intended).

## Migration / Rollout
No migration required.

## Open Questions
- None blocking.

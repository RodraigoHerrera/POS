# Spec: inventario-entrada (new capability) - show item unit in "Registrar entrada"

## Purpose
Operators entering stock must see the unit of the selected item next to the Cantidad field to avoid quantity errors.

## Helper contract
`labelUnidad(code?: string | null): string` in `src/lib/unidad.ts` (pure, no side effects).
- Returns `code.trim()` when the trimmed value is non-empty.
- Returns `"u"` when code is null, undefined, empty, or whitespace-only.
- Does not translate, uppercase, or otherwise alter a non-empty code (unidad_code is free text, VarChar(16)).

## Requirements

### R1: Unit hint for selected item (MUST)
When an item is selected in EntradaModal, the Cantidad input MUST show the hint text `Unidad: {code}` (Spanish UI copy), where `{code}` = labelUnidad(item.unidad_code) of the selected item, using data from the existing `/api/inventarios/items` fetch (no new request).

### R2: Fallback unit (MUST)
If the selected item's unidad_code is null, empty, or whitespace, the hint MUST read `Unidad: u`.

### R3: No hint without a valid selection (MUST)
No unit hint MUST be shown when (a) no item is selected, or (b) the selected item id is not present in the loaded items list.

### R4: Preset item (MUST)
When the modal opens with `presetItemId` (StockAlertsCard "Reponer"), the hint MUST appear for that item once the items options have loaded, with no user interaction. Before options load, no hint is shown.

### R5: Selection changes (MUST)
Changing the selected item MUST update the hint to the new item's unit; clearing the selection MUST remove the hint.

### R6: Non-functional constraints (MUST)
- No API, Prisma schema, or `registrarEntrada` changes.
- Hint is derived during render from selection state (no effect-synced state).
- No Playwright e2e; verification via helper unit tests (node:test), `tsc --noEmit`, and lint.

## Scenarios

### S1: Select item with unit (R1)
Given items loaded include item A with unidad_code "kg"
When the user selects item A
Then the Cantidad input shows "Unidad: kg".

### S2: Empty unit falls back (R2)
Given item B has unidad_code ""
When the user selects item B
Then the hint shows "Unidad: u".

### S3: Whitespace / null unit falls back (R2)
Given item C has unidad_code "   " (or null)
When the user selects item C
Then the hint shows "Unidad: u".

### S4: Padded code is trimmed (R1)
Given item D has unidad_code " l "
When the user selects item D
Then the hint shows "Unidad: l".

### S5: Nothing selected (R3a)
Given the modal is open and no item is selected
When it renders
Then no "Unidad:" text is shown.

### S6: Selected id not in list (R3b)
Given presetItemId or payload.item refers to an id absent from the loaded items
When the modal renders
Then no "Unidad:" text is shown.

### S7: Preset via Reponer (R4)
Given the modal opens with presetItemId = item A (unidad_code "kg")
When the items options finish loading
Then the hint shows "Unidad: kg" without user interaction.

### S8: Preset before load (R4)
Given presetItemId is set and items have not loaded yet
When the modal renders
Then no "Unidad:" text is shown, and it appears after loading completes.

### S9: Change selection (R5)
Given item A ("kg") is selected and the hint shows "Unidad: kg"
When the user selects item E ("l")
Then the hint shows "Unidad: l".

### S10: Clear selection (R5)
Given an item is selected with a visible hint
When the selection is cleared
Then the hint disappears.

### S11: Helper unit cases (helper contract)
labelUnidad("kg") = "kg"; (" kg ") = "kg"; ("") = "u"; ("  ") = "u"; (null) = "u"; (undefined) = "u".

## Test mapping
S11 (and S1-S4 logic) covered by node:test unit tests on labelUnidad. S1-S10 modal wiring verified by tsc + lint and manual review (no component test infra).

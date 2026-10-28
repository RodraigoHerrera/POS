# Feature: inventario-carga-masiva

## Objective
Add a bulk item upload feature via CSV template in the inventory module (`/admin/inventario`), supporting mass Upsert (insert if new or null identifier, update if existing by ID or SKU), UTF-8 encoding, CSV template download, and detailed row-by-row validation reporting.

## Problem / Why
Currently, items must be registered or edited one-by-one through modals in the admin inventory catalog. When onboarding suppliers or adjusting catalog details across many items, manual entry is slow and error-prone. A robust, validated CSV template upsert mechanism allows administrators to bulk-create and update items safely.

## Scope
- **Pure CSV parser & validator** (`src/lib/cargaMasivaItems.ts`):
  - RFC 4180 compliant parsing supporting quotes, commas, semicolons, and UTF-8 BOM (`\uFEFF`).
  - Header validation against required and optional item schema fields:
    `id,sku,nombre,tipo,unidad_code,costo_estandar,lead_time_dias` (per user request: `vida_util_dias` y `activo` quedan fuera del CSV).
  - Row typing and semantic validation:
    - `id`: Optional BigInt format.
    - `sku`: Optional unique string.
    - `nombre`: Required non-empty string.
    - `tipo`: Required on insert, must be one of `vendible`, `insumo`, `prep`, `oficina` (case-insensitive).
    - `unidad_code`: Required on insert.
    - `costo_estandar`: Optional non-negative decimal.
    - `lead_time_dias`: Optional non-negative integer (default 0).
  - In-file duplicate detection for `id` and `sku`.
- **Upsert Planner & Executor**:
  - Matches existing records by `id` (primary key) or `sku` (unique).
  - Existing item: executes UPDATE on modified columns (`nombre, sku, unidad_code, costo_estandar, lead_time_dias`), leaving `activo` and `vida_util_dias` untouched, rejecting prohibited changes (e.g., `tipo` immutable, `unidad_code` immutable if item has movement/stock history).
  - Null or non-existent identifier: executes INSERT with default `activo: true` (creates linked `producto` if `tipo === "vendible"`).
  - Generates row-by-row validation report (`fila`, `identificador`, `nombre`, `estado: "creado" | "actualizado" | "error"`, `errores: string[]`).
- **Endpoints**:
  - `GET /api/inventarios/items/plantilla-csv`: Serves a UTF-8 with BOM template CSV with headers (`id,sku,nombre,tipo,unidad_code,costo_estandar,lead_time_dias`) and example rows.
  - `POST /api/inventarios/items/carga-masiva`: Multipart/form-data or raw CSV upload (Admin only), runs upsert executor and returns structured report.
- **Frontend UI** (`src/components/inventario/modals/CargaMasivaModal.tsx` & `/admin/inventario`):
  - "Carga masiva" action button in the inventory catalog panel.
  - Modal with "Descargar Plantilla CSV" button.
  - Drag-and-drop / file selector for `.csv` file.
  - Visual summary card (Total, Creados, Actualizados, Errores).
  - Row-by-row results table with filter/badges for quick diagnosis of failed rows.
- **Out of Scope**:
  - Direct modification of stock quantities or Kardex movements (stock entries must go through `EntradaModal` / Kardex for audit trail integrity).

## Constraints
- Strict TDD (`npx tsx --test src/lib/cargaMasivaItems.test.ts`).
- Admin session authentication required (`requireEmpleado(["Administrador"])`).
- UTF-8 encoding handling (including BOM).
- Do not touch unrelated uncommitted user changes.

## Tasks
- [x] T1 Pure CSV parser & validator helper with strict TDD (`src/lib/cargaMasivaItems.ts`, `src/lib/cargaMasivaItems.test.ts`)
- [x] T2 Upsert logic planner & in-file duplicate detector with strict TDD
- [x] T3 Database Upsert executor with contract tests
- [x] T4 API routes: `GET /api/inventarios/items/plantilla-csv` and `POST /api/inventarios/items/carga-masiva`
- [x] T5 Frontend Modal `CargaMasivaModal.tsx` with download, file upload, and row-by-row validation report
- [x] T6 Integrate modal and button into `src/app/(usuario)/admin/inventario/page.tsx`
- [x] T7 Refine template: exclude `vida_util_dias` and `activo` from CSV headers, defaulting `activo: true` on creation and preserving it on updates.
- [x] T8 Full verification: unit tests, `npx tsc --noEmit`, and lint

## Acceptance criteria
- Administrator can download a valid UTF-8 `.csv` template with the exact 7 headers (`id,sku,nombre,tipo,unidad_code,costo_estandar,lead_time_dias`).
- `vida_util_dias` y `activo` no se solicitan en la plantilla ni se sobreescriben en update.
- Uploading a CSV with new rows creates new items with `activo: true` (and product if `vendible`).
- Uploading a CSV with existing `id` or `sku` updates modified fields.
- Rows with invalid types, invalid enums, or file-internal duplicates fail gracefully with clear row-by-row error messages.
- Total counts (total, creados, actualizados, fallidos) accurately reflect the operations.

## TDD
- Mode: enabled (source: project configuration / CLAUDE.md). Runner: `npx tsx --test`.

## Progress
- Created 2026-10-28.
- T1-T3: Implemented with strict TDD in `src/lib/cargaMasivaItems.ts` (+13 tests passing in `src/lib/cargaMasivaItems.test.ts`).
- T4: Implemented `GET /api/inventarios/items/plantilla-csv` (UTF-8 BOM download) and `POST /api/inventarios/items/carga-masiva`.
- T5-T6: Created `CargaMasivaModal.tsx` and wired into `src/app/(usuario)/admin/inventario/page.tsx`.
- T7: Excluded `vida_util_dias` and `activo` from CSV headers and model parsing.
- T8: `npx tsc --noEmit` and `npx eslint` pass cleanly with 0 errors across touched files. Full unit tests pass (13/13).

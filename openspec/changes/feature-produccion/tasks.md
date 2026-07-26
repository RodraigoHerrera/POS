# Tasks: feature-produccion

## Review Workload Forecast
- Decision needed before apply: No
- Chain strategy: size-exception

## Phase 1: Database/Algorithms (FEFO Logic Extraction)
1. [x] **Create FEFO pure logic utility**: Create `src/lib/fefo-logic.ts`. Implement a pure function `calculateFEFODeductions(lots, requiredQuantity)` that returns the deduction map or throws an error if insufficient.
2. [x] **Unit Test FEFO pure logic**: Create `src/lib/fefo-logic.test.ts`. Add tests for exact match, partial deduction across multiple lots, and insufficient stock scenarios.

## Phase 2: Server Action
1. [x] **Define action signature**: Create `src/app/actions/produccion.ts`. Export `executeProductionBatch(input: ProductionBatchInput)` returning `ProductionBatchResult`.
2. [x] **Implement recipe fetching**: Query the database for the recipe and its required ingredients using Prisma.
3. [x] **Implement Prisma $transaction setup**: Wrap logic in `prisma.$transaction` with `Serializable` isolation level.
4. [x] **Implement FEFO execution**: For each ingredient, fetch lots ordered by `expirationDate` asc. Use `calculateFEFODeductions` to determine amounts.
5. [x] **Update lots and log movements**: Apply deductions via `tx.lot.update` and log to `tx.inventoryMovement.create` with type `PRODUCTION_USAGE`.
6. [x] **Generate new lot**: Create the new lot via `tx.lot.create` and log the positive movement (`PRODUCTION_OUTPUT`).

## Phase 3: UI - React Form
1. [x] **Create Production page**: Create `src/app/(usuario)/admin/produccion/page.tsx` with a basic layout and title.
2. [x] **Implement Recipe Selector**: Add a dropdown to choose a recipe (fetch recipes via a server component).
3. [x] **Implement Quantity Input**: Add an input field for batch quantity with validation (> 0).
4. [x] **Wire up Server Action**: Import `executeProductionBatch`. Add submit button with loading state. Display success/error messages based on action result.

## Phase 4: Testing
1. [x] **Integration Test (Database)**: Create `tests/integration/produccion-action.test.ts`. Seed a test recipe and lots. Execute `executeProductionBatch` and verify database state.
2. [x] **Concurrency Test**: Execute `Promise.all` with multiple identical batch requests and verify no negative stock occurs.
3. [x] **E2E Test (UI)**: Create `tests/e2e/produccion.spec.ts`. Navigate to `/admin/produccion`, select recipe, enter quantity, submit, and verify success message.

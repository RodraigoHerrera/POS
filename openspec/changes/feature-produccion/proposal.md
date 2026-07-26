# Proposal: feature-produccion

## Executive Summary
This proposal outlines the implementation of a new "Recetas y Producción" (Mise en Place) feature. It enables users to execute production batches based on recipes. The system will automatically deduct the required raw materials from existing inventory using a FEFO (First Expired, First Out) strategy, generate a new lot for the produced item, and maintain a comprehensive log of all related inventory movements.

## Affected Areas
- **Frontend**: New UI for production management at `src/app/(usuario)/admin/produccion/page.tsx`.
- **Backend**: New Server Actions for business logic at `src/app/actions/produccion.ts` (or `app/actions/produccion.ts`).
- **Database / Data Access**: Prisma client interactions specifically focused on transaction management for inventory updates.

## New Capabilities
- **Execute Production Batch**: Users can initiate a production batch for a specified recipe and quantity.
- **FEFO Inventory Deduction**: Automatic deduction of raw materials based on a First Expired, First Out strategy.
- **Lot Generation**: Automatic generation of a new lot for the resulting produced items.
- **Inventory Movement Logging**: Detailed logging of stock deductions and additions for traceability and auditing.

## Modified Capabilities
- *(No existing capabilities are modified; this is a net new feature additions.)*

## Architectural Decisions
- **Frontend State**: The production form will utilize plain React state for simplicity and localized state management.
- **Backend Communication**: Server Actions will be used to process the production logic securely on the server side.
- **Data Integrity via Transactions**: The core production logic—deducting ingredients, creating the new lot, and logging movements—will be strictly encapsulated within a single Prisma `$transaction`. This guarantees atomicity; if any step fails (e.g., insufficient stock), the entire operation rolls back.
- **Concurrency & Race Condition Mitigation**: Explicit care will be taken during the FEFO deduction phase within the database transaction to acquire necessary row-level locks or rely on transaction isolation levels, preventing race conditions when concurrent production requests attempt to consume the same raw material lots.

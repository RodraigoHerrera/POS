# Capability: Inventory Movement Logging

## Description
This capability maintains a detailed log of all stock deductions (raw materials) and additions (produced items) associated with a production batch for traceability and auditing purposes.

## Requirements
- The system MUST create an inventory movement record for every deduction from a raw material lot.
- The system MUST create an inventory movement record for the addition to the newly generated lot of the produced item.
- The system SHALL include timestamps, quantities, associated lot IDs, and the production batch ID in all movement records.
- The system MUST ensure all movement logging occurs within the same database transaction as the inventory updates.

## Scenarios

### Scenario 1: Logging deductions
- **GIVEN** raw materials have been deducted during a production batch
- **WHEN** logging the movements
- **THEN** the system MUST create negative adjustment records detailing the exact quantities removed from specific lots.

### Scenario 2: Logging additions
- **GIVEN** a new lot has been generated for a produced item
- **WHEN** logging the movements
- **THEN** the system MUST create a positive adjustment record detailing the exact quantity added to the new lot.

### Scenario 3: Transactional consistency
- **GIVEN** an error occurs during the production batch execution
- **WHEN** the database transaction rolls back
- **THEN** the system MUST ensure no orphaned or partial movement logs are persisted in the database.

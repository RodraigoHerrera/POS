# Capability: Lot Generation

## Description
This capability automatically generates a new lot for the items produced at the end of a successful production batch.

## Requirements
- The system MUST create a new lot record for the produced item.
- The system SHALL assign a unique lot identifier to the newly created lot.
- The system MUST set the initial quantity of the new lot to the quantity specified in the production batch.
- The system MAY calculate an expiration date for the new lot based on the item's predefined shelf life, if applicable.
- The system MUST associate the new lot with the relevant production batch for traceability.

## Scenarios

### Scenario 1: Successful Lot Creation
- **GIVEN** a production batch has successfully deducted raw materials
- **WHEN** the lot generation process is triggered
- **THEN** the system MUST create a new lot for the produced item with the correct quantity
- **AND** store this new lot in the database.

### Scenario 2: Lot association with production run
- **GIVEN** a newly generated lot
- **WHEN** the lot is saved
- **THEN** the system MUST establish a link between the lot and the specific production execution event.

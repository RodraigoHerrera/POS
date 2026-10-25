# Capability: FEFO Inventory Deduction

## Description
This capability automatically deducts the required raw materials from existing inventory based on a First Expired, First Out (FEFO) strategy when a production batch is executed.

## Requirements
- The system MUST calculate the total required quantity of each raw material based on the recipe and batch quantity.
- The system MUST deduct raw materials from inventory lots ordered by their expiration date (oldest first).
- The system SHALL ensure that if one lot does not have sufficient quantity, it continues deducting from the next oldest lot until the required quantity is met.
- The system MUST abort the entire operation and rollback any changes if there is insufficient total stock for any required raw material.
- The system MUST prevent race conditions when concurrent production requests attempt to consume the same raw material lots by using transaction locking or an appropriate transaction isolation level.

## Scenarios

### Scenario 1: Deduction from a single lot
- **GIVEN** an active production batch
- **AND** a required raw material has sufficient quantity in the oldest lot
- **WHEN** the system deducts the inventory
- **THEN** the entire required quantity MUST be deducted from that single lot.

### Scenario 2: Deduction across multiple lots
- **GIVEN** an active production batch
- **AND** a required raw material requires deduction across multiple lots to meet the required quantity
- **WHEN** the system deducts the inventory
- **THEN** it MUST exhaust the oldest lot first before moving to the next oldest lot until the total requirement is met.

### Scenario 3: Insufficient total stock
- **GIVEN** an active production batch
- **AND** a required raw material does not have sufficient total quantity across all available lots
- **WHEN** the system attempts to deduct the inventory
- **THEN** the system MUST abort the production process
- **AND** ensure no partial deductions are committed to the database.

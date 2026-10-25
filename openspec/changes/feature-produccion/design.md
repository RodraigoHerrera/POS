# Technical Design: feature-produccion

## Technical Approach
The "Recetas y Producción" feature introduces a production management system that allows users to create batches of items based on predefined recipes. The approach involves a React-based frontend form where users select a recipe and quantity. This form submits data to a new Next.js Server Action which handles the core business logic. 
To ensure data integrity, the entire operation—deducting raw materials based on a First Expired, First Out (FEFO) strategy, generating a new inventory lot for the produced item, and recording inventory movements—will be encapsulated within a single Prisma `$transaction`.

## Architecture Decisions
1. **Server Actions for Mutations**: We use Next.js Server Actions (`src/app/actions/produccion.ts`) to handle the production batch logic securely on the server.
2. **Transactional Data Integrity**: A Prisma `$transaction` guarantees atomicity. If a raw material lacks sufficient stock or any other error occurs, the entire batch creation rolls back, preventing orphaned data or incorrect inventory states.
3. **FEFO (First Expired, First Out) Strategy**: The system fetches available lots for each raw material, ordered by expiration date (ascending). The deduction logic sequentially subtracts from the oldest lots until the required quantity is met.
4. **Concurrency Handling**: To prevent race conditions during the FEFO deduction phase, the Prisma transaction will utilize an appropriate transaction isolation level (e.g., `Serializable`) to ensure concurrent requests consuming the same raw materials are handled sequentially without data anomalies.
5. **Client-side State**: Local React state is sufficient for managing the production form inputs (recipe selection, quantity) and handling submission status.

## Data Flow
1. **User Input**: The user selects a recipe and quantity on the frontend (`/admin/produccion`).
2. **Action Invocation**: The frontend calls the `executeProductionBatch` Server Action with the selected parameters.
3. **Validation**: The Server Action validates the input (e.g., quantity > 0) and fetches the recipe details to determine required raw materials.
4. **Transaction Initiation**: A Prisma `$transaction` starts.
5. **FEFO Deduction Loop**: For each raw material in the recipe:
   - Fetch available lots ordered by `expirationDate` ASC.
   - Loop through lots, deducting the required amount.
   - Create negative inventory movement logs for each deduction.
   - If available lots run out before the requirement is met, throw an error to rollback the transaction.
6. **Lot Generation**: Create a new lot for the produced item with the total batch quantity. Calculate the new expiration date if applicable.
7. **Addition Logging**: Create a positive inventory movement log for the newly created lot.
8. **Commit & Response**: The transaction commits successfully. The Server Action returns a success response to the client, which updates the UI.

## Interfaces

### Server Action Signature
```typescript
type ProductionBatchInput = {
  recipeId: string;
  quantity: number;
};

type ProductionBatchResult = {
  success: boolean;
  message: string;
  newLotId?: string;
};

/**
 * Executes a production batch, deducting raw materials via FEFO,
 * creating a new lot, and logging inventory movements.
 */
export async function executeProductionBatch(
  input: ProductionBatchInput
): Promise<ProductionBatchResult>
```

### Prisma $transaction Algorithm (FEFO)
Inside the Server Action, the transaction will follow this pseudocode structure:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Fetch recipe and ingredients
  const recipe = await tx.recipe.findUnique({ include: { ingredients: true } });
  
  // 2. Process FEFO deductions
  for (const ingredient of recipe.ingredients) {
    const requiredTotal = ingredient.quantity * input.quantity;
    let remainingToDeduct = requiredTotal;
    
    // Fetch lots ordered by expiration date.
    const lots = await tx.lot.findMany({
      where: { itemId: ingredient.itemId, quantity: { gt: 0 } },
      orderBy: { expirationDate: 'asc' }
    });
    
    for (const lot of lots) {
      if (remainingToDeduct <= 0) break;
      
      const deductionAmount = Math.min(lot.quantity, remainingToDeduct);
      
      // Update lot quantity
      await tx.lot.update({
        where: { id: lot.id },
        data: { quantity: lot.quantity - deductionAmount }
      });
      
      // Log negative movement
      await tx.inventoryMovement.create({
        data: { lotId: lot.id, quantity: -deductionAmount, type: 'PRODUCTION_USAGE' }
      });
      
      remainingToDeduct -= deductionAmount;
    }
    
    if (remainingToDeduct > 0) {
      throw new Error(`Insufficient stock for ingredient ${ingredient.itemId}`);
    }
  }
  
  // 3. Generate New Lot
  const newLot = await tx.lot.create({
    data: {
      itemId: recipe.outputItemId,
      quantity: input.quantity,
      // Calculate expirationDate based on item's shelf life if applicable
    }
  });
  
  // 4. Log positive movement
  await tx.inventoryMovement.create({
    data: { lotId: newLot.id, quantity: input.quantity, type: 'PRODUCTION_OUTPUT' }
  });
  
  return newLot;
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); // To handle concurrency
```

## File Changes
- **New File**: `src/app/(usuario)/admin/produccion/page.tsx` - Frontend UI for executing production batches.
- **New File**: `src/app/actions/produccion.ts` - Server Action containing the business logic and Prisma transaction.

## Testing Strategy
1. **Unit Tests (Server Action)**: Mock the Prisma client to test the FEFO algorithm. Verify it deducts correctly from single/multiple lots, rolls back on insufficient stock, and calculates quantities correctly.
2. **Integration Tests (Database)**: Use a test database to execute the Server Action end-to-end. Verify database state (lots updated, movements logged, new lot created).
3. **Concurrency Tests**: Simulate multiple simultaneous calls to `executeProductionBatch` consuming the same raw materials to ensure the transaction isolation level prevents negative stock anomalies.
4. **UI Tests**: Test the frontend form validation (quantity > 0), loading states during submission, and success/error feedback display.

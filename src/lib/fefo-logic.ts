import { Prisma } from '@prisma/client';

type DecimalType = Prisma.Decimal | number;

export interface FEFOLot {
  id: bigint | number | string;
  quantity: DecimalType;
}

export interface FEFODeduction {
  lotId: bigint | number | string;
  deductedAmount: number;
}

/**
 * Calculates how much to deduct from a series of lots based on FEFO (First Expired, First Out).
 * Assumes the `lots` array is already sorted by expiration date ascending.
 *
 * @param lots - Available lots
 * @param requiredQuantity - Total quantity needed
 * @returns Array of deductions per lot
 * @throws Error if the total available stock in lots is less than requiredQuantity
 */
export function calculateFEFODeductions(
  lots: FEFOLot[],
  requiredQuantity: DecimalType
): FEFODeduction[] {
  const required = 
    typeof requiredQuantity === 'number' 
      ? requiredQuantity 
      : requiredQuantity.toNumber();
  
  if (required <= 0) return [];

  const deductions: FEFODeduction[] = [];
  let remainingToDeduct = required;

  for (const lot of lots) {
    if (remainingToDeduct <= 0) break;

    const lotQty = 
      typeof lot.quantity === 'number' 
        ? lot.quantity 
        : lot.quantity.toNumber();
        
    if (lotQty <= 0) continue;

    const deductionAmount = Math.min(lotQty, remainingToDeduct);
    deductions.push({
      lotId: lot.id,
      deductedAmount: deductionAmount,
    });
    
    remainingToDeduct -= deductionAmount;
  }

  // Allow a tiny epsilon for floating point math precision issues
  if (remainingToDeduct > 0.000001) {
    throw new Error(`Insufficient stock for FEFO deduction. Missing: ${remainingToDeduct.toFixed(4)}`);
  }

  return deductions;
}

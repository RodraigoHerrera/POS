import { Prisma } from '@prisma/client';

type DecimalType = Prisma.Decimal | number | string;

export interface FEFOLot {
  id: bigint | number | string;
  quantity: DecimalType;
}

export interface FEFODeduction {
  lotId: bigint | number | string;
  deductedAmount: number;
}

export const STOCK_EPSILON = 0.0001;

/**
 * Calculates how much to deduct from a series of lots based on FEFO (First Expired, First Out).
 * Assumes the `lots` array is already sorted by expiration date ascending.
 *
 * Utiliza Prisma.Decimal internamente para garantizar precisión y evitar
 * falsos rechazos por residuos de coma flotante IEEE-754.
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
  const required = new Prisma.Decimal(requiredQuantity.toString());

  if (required.lessThanOrEqualTo(0)) return [];

  const deductions: FEFODeduction[] = [];
  let remainingToDeduct = required;

  for (const lot of lots) {
    if (remainingToDeduct.lessThanOrEqualTo(0)) break;

    const lotQty = new Prisma.Decimal(lot.quantity.toString());
    if (lotQty.lessThanOrEqualTo(0)) continue;

    const deductionAmount = Prisma.Decimal.min(lotQty, remainingToDeduct);
    deductions.push({
      lotId: lot.id,
      deductedAmount: deductionAmount.toDecimalPlaces(3).toNumber(),
    });

    remainingToDeduct = remainingToDeduct.sub(deductionAmount);
  }

  // Tolerancia para descartar residuos despreciables (< 0.0001)
  if (remainingToDeduct.greaterThan(STOCK_EPSILON)) {
    throw new Error(`Insufficient stock for FEFO deduction. Missing: ${remainingToDeduct.toFixed(4)}`);
  }

  return deductions;
}

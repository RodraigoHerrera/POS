"use server";

import { ejecutarProduccion, ProductionBatchResult } from '@/lib/produccion';

export type ProductionBatchInput = {
  recipeId: string;
  quantity: number;
};

/**
 * Server action: requires an Administrador session; the branch always comes
 * from that session, never from the client.
 */
export async function executeProductionBatch(
  input: ProductionBatchInput
): Promise<ProductionBatchResult> {
  return ejecutarProduccion(input);
}

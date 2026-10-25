"use server";

import { prisma } from '@/lib/db';
import { calculateFEFODeductions } from '@/lib/fefo-logic';
import { Prisma } from '@prisma/client';

export type ProductionBatchInput = {
  recipeId: string;
  quantity: number;
  sucursalId: string;
};

export type ProductionBatchResult = {
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
): Promise<ProductionBatchResult> {
  if (!input.recipeId || input.quantity <= 0 || !input.sucursalId) {
    return { success: false, message: 'Parámetros inválidos' };
  }

  try {
    const recipeIdNum = BigInt(input.recipeId);
    const sucursalIdNum = BigInt(input.sucursalId);
    const batchQty = new Prisma.Decimal(input.quantity);

    const newLotObj = await prisma.$transaction(async (tx) => {
      // 1. Fetch recipe and ingredients
      const recipe = await tx.receta.findUnique({
        where: { id: recipeIdNum },
        include: { items: true },
      });

      if (!recipe) {
        throw new Error(`Receta con ID ${input.recipeId} no encontrada`);
      }

      // Check if vendible item is prep/vendible, we can get its details
      const outputItem = await tx.item.findUnique({
        where: { id: recipe.item_vendible_id }
      });
      if (!outputItem) {
        throw new Error('El item de salida de la receta no existe');
      }

      let totalBatchCost = new Prisma.Decimal(0);
      const usedIngredients: Array<{ insumoId: bigint, loteId: bigint, cant: Prisma.Decimal }> = [];

      // 2. Process FEFO deductions
      for (const ingredient of recipe.items) {
        const requiredTotal = ingredient.cantidad.mul(batchQty);

        // Fetch lots ordered by expiration date.
        const availableLots = await tx.stockLoteSucursal.findMany({
          where: {
            sucursal_id: sucursalIdNum,
            lote: { item_id: ingredient.item_insumo_id },
            cantidad: { gt: 0 },
          },
          include: { lote: true },
          orderBy: [
            { lote: { fecha_caducidad: 'asc' } },
            { lote: { creado_en: 'asc' } }
          ]
        });

        const fefoLots = availableLots.map(lotInfo => ({
          id: lotInfo.lote.id,
          quantity: lotInfo.cantidad,
        }));

        let deductions;
        try {
          deductions = calculateFEFODeductions(fefoLots, requiredTotal);
        } catch (err: any) {
          throw new Error(`Insumo insuficiente (ID ${ingredient.item_insumo_id}): ${err.message}`);
        }

        for (const deduction of deductions) {
          const decDeducted = new Prisma.Decimal(deduction.deductedAmount);
          const lotInfo = availableLots.find(l => l.lote.id === deduction.lotId);
          const lotUnitCost = lotInfo?.lote.costo_unit || new Prisma.Decimal(0);

          totalBatchCost = totalBatchCost.add(lotUnitCost.mul(decDeducted));
          usedIngredients.push({
            insumoId: ingredient.item_insumo_id,
            loteId: deduction.lotId as bigint,
            cant: decDeducted,
          });

          // Update stockLoteSucursal
          await tx.stockLoteSucursal.update({
            where: {
              sucursal_id_lote_id: {
                sucursal_id: sucursalIdNum,
                lote_id: deduction.lotId as bigint,
              }
            },
            data: { cantidad: { decrement: decDeducted } }
          });

          // Update inventarioSucursal
          await tx.inventarioSucursal.update({
            where: {
              sucursal_id_item_id: {
                sucursal_id: sucursalIdNum,
                item_id: ingredient.item_insumo_id,
              }
            },
            data: { stock: { decrement: decDeducted } }
          });

          // Log negative movement
          await tx.movimientoInventario.create({
            data: {
              sucursal_id: sucursalIdNum,
              item_id: ingredient.item_insumo_id,
              lote_id: deduction.lotId as bigint,
              tipo: 'Salida',
              motivo: 'Produccion',
              cantidad: decDeducted,
              costo_unit: lotUnitCost,
            }
          });
        }
      }

      const unitCost = batchQty.gt(0) ? totalBatchCost.div(batchQty) : new Prisma.Decimal(0);

      // 3. Generate New Lot
      let fechaCaducidad = null;
      if (outputItem.vida_util_dias && outputItem.vida_util_dias > 0) {
        fechaCaducidad = new Date();
        fechaCaducidad.setDate(fechaCaducidad.getDate() + outputItem.vida_util_dias);
      }

      const createdLot = await tx.lote.create({
        data: {
          item_id: recipe.item_vendible_id,
          codigo_lote: `PROD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          costo_unit: unitCost,
          fecha_caducidad: fechaCaducidad,
          creado_en: new Date(),
        }
      });

      // Update or create stockLoteSucursal
      await tx.stockLoteSucursal.create({
        data: {
          sucursal_id: sucursalIdNum,
          lote_id: createdLot.id,
          cantidad: batchQty,
        }
      });

      // Update or create inventarioSucursal
      const invSucursal = await tx.inventarioSucursal.findUnique({
        where: { sucursal_id_item_id: { sucursal_id: sucursalIdNum, item_id: recipe.item_vendible_id } }
      });

      if (invSucursal) {
        // Average cost simplified logic
        const newTotalValue = invSucursal.stock.mul(invSucursal.costo_promedio).add(totalBatchCost);
        const newTotalStock = invSucursal.stock.add(batchQty);
        const newCostoPromedio = newTotalStock.gt(0) ? newTotalValue.div(newTotalStock) : new Prisma.Decimal(0);

        await tx.inventarioSucursal.update({
          where: { sucursal_id_item_id: { sucursal_id: sucursalIdNum, item_id: recipe.item_vendible_id } },
          data: {
            stock: newTotalStock,
            costo_promedio: newCostoPromedio,
          }
        });
      } else {
        await tx.inventarioSucursal.create({
          data: {
            sucursal_id: sucursalIdNum,
            item_id: recipe.item_vendible_id,
            stock: batchQty,
            costo_promedio: unitCost,
          }
        });
      }

      // 4. Log positive movement
      await tx.movimientoInventario.create({
        data: {
          sucursal_id: sucursalIdNum,
          item_id: recipe.item_vendible_id,
          lote_id: createdLot.id,
          tipo: 'Entrada',
          motivo: 'Produccion',
          cantidad: batchQty,
          costo_unit: unitCost,
        }
      });

      // 5. Create Produccion log records
      const prodRecord = await tx.produccion.create({
        data: {
          sucursal_id: sucursalIdNum,
          prep_item_id: recipe.item_vendible_id,
          cantidad: batchQty,
          lote_generado_id: createdLot.id,
        }
      });

      // Bulk create items for produccion
      if (usedIngredients.length > 0) {
        await tx.produccionItem.createMany({
          data: usedIngredients.map(ui => ({
            produccion_id: prodRecord.id,
            item_insumo_id: ui.insumoId,
            cantidad: ui.cant,
            lote_consumido_id: ui.loteId,
          }))
        });
      }

      return createdLot;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return {
      success: true,
      message: 'Lote de producción generado con éxito.',
      newLotId: newLotObj.id.toString(),
    };
  } catch (error: any) {
    console.error('Production Error:', error);
    return {
      success: false,
      message: error.message || 'Error desconocido durante la producción.',
    };
  }
}

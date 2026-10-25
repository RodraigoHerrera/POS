import { Prisma } from '@prisma/client';

/**
 * Rounds a numeric value to 6 decimal places.
 */
export function round6Decimals(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Calculates the new weighted average cost (costo promedio ponderado)
 * for an inventory item upon stock intake.
 *
 * Rules:
 * - If current stock is <= 0 or cumulative stock (stockActual + qtyEntrada) <= 0,
 *   cost is reset to the intake unit cost rounded to 6 decimals.
 * - Otherwise, computes the weighted average:
 *   ((stockActual * costoActual) + (qtyEntrada * costoEntrada)) / (stockActual + qtyEntrada)
 *   rounded to 6 decimals.
 */
export function calcularNuevoCostoPromedio(
  stockActual: number,
  costoActual: number,
  qtyEntrada: number,
  costoEntrada: number
): number {
  if (stockActual <= 0 || (stockActual + qtyEntrada) <= 0) {
    return round6Decimals(costoEntrada);
  }

  const nuevoCosto =
    (stockActual * costoActual + qtyEntrada * costoEntrada) /
    (stockActual + qtyEntrada);

  return round6Decimals(nuevoCosto);
}

/**
 * Updates branch inventory for a stock intake with pessimistic row locking:
 * 1. Upserts base row with stock: 0, costo_promedio: 0 on sucursal_id_item_id
 *    to guarantee physical row existence (eliminates gap-lock deadlocks and P2002 collisions).
 * 2. Queries row with exclusive pessimistic lock:
 *    SELECT id, stock, costo_promedio FROM `inventarioSucursal` WHERE sucursal_id = ? AND item_id = ? FOR UPDATE
 * 3. Computes new weighted average cost and new stock level.
 * 4. Updates locked row with new stock and costo_promedio.
 */
export async function actualizarInventarioEntrada(
  tx: Prisma.TransactionClient,
  sucursalId: bigint | string | number,
  itemId: bigint | string | number,
  qtyEntrada: number,
  costoEntrada: number
): Promise<any> {
  const sucursalBigInt = BigInt(sucursalId);
  const itemBigInt = BigInt(itemId);

  // 1. Ensure physical row existence to eliminate gap locks and insert race conditions
  await tx.inventarioSucursal.upsert({
    where: {
      sucursal_id_item_id: {
        sucursal_id: sucursalBigInt,
        item_id: itemBigInt,
      },
    },
    create: {
      sucursal_id: sucursalBigInt,
      item_id: itemBigInt,
      stock: 0,
      costo_promedio: 0,
    },
    update: {},
  });

  // 2. Lock row exclusively for update
  const rows = await tx.$queryRaw<
    Array<{ id: bigint; stock: any; costo_promedio: any }>
  >`SELECT id, stock, costo_promedio FROM \`inventarioSucursal\` WHERE sucursal_id = ${sucursalBigInt} AND item_id = ${itemBigInt} FOR UPDATE`;

  if (!rows || rows.length === 0) {
    throw new Error('INVENTARIO_SUCURSAL_NOT_FOUND');
  }

  const locked = rows[0];
  const stockActual = Number(locked.stock?.toString() ?? locked.stock ?? 0);
  const costoActual = Number(
    locked.costo_promedio?.toString() ?? locked.costo_promedio ?? 0
  );

  // 3. Compute weighted average cost and new stock
  const nuevoCosto = calcularNuevoCostoPromedio(
    stockActual,
    costoActual,
    qtyEntrada,
    costoEntrada
  );
  const nuevoStock = Number((stockActual + qtyEntrada).toFixed(3));

  // 4. Update the locked row
  return await tx.inventarioSucursal.update({
    where: { id: BigInt(locked.id) },
    data: {
      stock: nuevoStock,
      costo_promedio: nuevoCosto,
    },
  });
}

import { Prisma } from '@prisma/client';

/**
 * Deterministic BigInt ascending comparator:
 * BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0
 */
export function compareBigIntAsc(
  a: bigint | string | number,
  b: bigint | string | number
): number {
  const bigA = BigInt(a);
  const bigB = BigInt(b);
  return bigA < bigB ? -1 : bigA > bigB ? 1 : 0;
}

/**
 * Returns value rounded to 3 decimal places to prevent IEEE-754 precision issues.
 */
export function round3Decimals(value: number): number {
  return Number(value.toFixed(3));
}

export interface LoteDisponible {
  id: bigint | string | number;
  lote_id: bigint | string | number;
  cantidad: number | string | { toString(): string };
  lote: {
    item_id: bigint | string | number;
    costo_unit: number | string | { toString(): string };
    fecha_caducidad?: Date | string | null;
  };
}

export interface RequerimientoInsumo {
  insumoId: bigint | string | number;
  cantidadRequerida: number;
}

export interface SimularConsumoOptions {
  allowPartialDrop?: boolean;
  throwOnShortage?: boolean;
}

export interface LotDecrement {
  id: bigint;
  lote_id: bigint;
  item_id: bigint;
  costo_unit: number;
  total: number;
}

export interface InventarioDecrement {
  item_id: bigint;
  total: number;
}

export interface FefoSimulationResult {
  lotDecrements: LotDecrement[];
  inventarioDecrements: InventarioDecrement[];
  costoPorItem: number[];
  successfulItemsIndices: number[];
  droppedItemsIndices: number[];
  insumosSinStock: bigint[];
}

export class InsufficientStockError extends Error {
  public insumoIds: bigint[];
  constructor(message: string, insumoIds: bigint[] = []) {
    super(message);
    this.name = 'InsufficientStockError';
    this.insumoIds = insumoIds;
    Object.setPrototypeOf(this, InsufficientStockError.prototype);
  }
}

interface LoteInterno {
  id: bigint;
  lote_id: bigint;
  costo_unit: number;
  restante: number;
  caducidadTimestamp: number;
}

/**
 * In-memory simulation allocating earliest expiring lot first (FEFO),
 * consolidating duplicate lot and inventory demands, rounding to 3 decimals,
 * and returning lotDecrements sorted by BigInt(id) ASC (INV-1) and
 * inventarioDecrements sorted by BigInt(item_id) ASC (INV-2).
 */
export function simularConsumoFEFO(
  lotesDisponibles: LoteDisponible[],
  requerimientosPorItem: RequerimientoInsumo[][],
  options?: SimularConsumoOptions
): FefoSimulationResult {
  const allowPartialDrop = options?.allowPartialDrop ?? false;

  // 1. Group available lots by insumo item_id
  const lotesPorInsumo = new Map<string, LoteInterno[]>();
  for (const stockLote of lotesDisponibles) {
    const key = BigInt(stockLote.lote.item_id).toString();
    const list = lotesPorInsumo.get(key) ?? [];

    let caducidad = Infinity;
    if (stockLote.lote.fecha_caducidad) {
      const d = stockLote.lote.fecha_caducidad instanceof Date
        ? stockLote.lote.fecha_caducidad
        : new Date(stockLote.lote.fecha_caducidad);
      caducidad = isNaN(d.getTime()) ? Infinity : d.getTime();
    }

    list.push({
      id: BigInt(stockLote.id),
      lote_id: BigInt(stockLote.lote_id),
      costo_unit: Number(stockLote.lote.costo_unit),
      restante: round3Decimals(Number(stockLote.cantidad)),
      caducidadTimestamp: caducidad,
    });
    lotesPorInsumo.set(key, list);
  }

  // Sort lots deterministically for each insumo: earliest expiration first, then by id ASC
  for (const list of lotesPorInsumo.values()) {
    list.sort((a, b) => {
      if (a.caducidadTimestamp !== b.caducidadTimestamp) {
        return a.caducidadTimestamp < b.caducidadTimestamp ? -1 : 1;
      }
      return compareBigIntAsc(a.id, b.id);
    });
  }

  const lotDecrementsMap = new Map<string, LotDecrement>();
  const inventarioDecrementsMap = new Map<string, number>();
  const costoPorItem: number[] = [];
  const insumosSinStockSet = new Set<string>();
  const successfulItemsIndices: number[] = [];
  const droppedItemsIndices: number[] = [];

  for (let idx = 0; idx < requerimientosPorItem.length; idx++) {
    const reqs = requerimientosPorItem[idx];
    let costoAcumuladoDelItem = 0;
    let itemHasStock = true;

    // Temporary tracking for this item in case partial drop is enabled
    const tempLotDecrements = new Map<string, { lote: LoteInterno; item_id: bigint; aDescontar: number }>();
    const tempInventarioDecrements = new Map<string, number>();

    for (const { insumoId, cantidadRequerida } of reqs) {
      let restante = round3Decimals(cantidadRequerida);
      const insumoKey = BigInt(insumoId).toString();
      const lotes = lotesPorInsumo.get(insumoKey) ?? [];

      for (const lote of lotes) {
        if (restante <= 0) break;
        if (lote.restante <= 0) continue;

        const aDescontar = round3Decimals(Math.min(lote.restante, restante));
        if (aDescontar <= 0) continue;

        lote.restante = round3Decimals(lote.restante - aDescontar);
        restante = round3Decimals(restante - aDescontar);

        const lotKey = lote.id.toString();
        const existingTemp = tempLotDecrements.get(lotKey);
        if (existingTemp) {
          existingTemp.aDescontar = round3Decimals(existingTemp.aDescontar + aDescontar);
        } else {
          tempLotDecrements.set(lotKey, {
            lote,
            item_id: BigInt(insumoId),
            aDescontar,
          });
        }

        tempInventarioDecrements.set(
          insumoKey,
          round3Decimals((tempInventarioDecrements.get(insumoKey) ?? 0) + aDescontar)
        );

        costoAcumuladoDelItem += aDescontar * lote.costo_unit;
      }

      // Tolerance of 0.0001 to prevent IEEE-754 precision false positives
      if (restante > 0.0001) {
        itemHasStock = false;
        insumosSinStockSet.add(insumoKey);
        if (allowPartialDrop) {
          break;
        }
      }
    }

    if (allowPartialDrop) {
      if (itemHasStock) {
        // Commit decrements to global maps
        for (const [lotKey, { lote, item_id, aDescontar }] of tempLotDecrements) {
          const acum = lotDecrementsMap.get(lotKey) ?? {
            id: lote.id,
            lote_id: lote.lote_id,
            item_id,
            costo_unit: lote.costo_unit,
            total: 0,
          };
          acum.total = round3Decimals(acum.total + aDescontar);
          lotDecrementsMap.set(lotKey, acum);
        }

        for (const [insumoKey, qty] of tempInventarioDecrements) {
          inventarioDecrementsMap.set(
            insumoKey,
            round3Decimals((inventarioDecrementsMap.get(insumoKey) ?? 0) + qty)
          );
        }

        costoPorItem[idx] = round3Decimals(costoAcumuladoDelItem);
        successfulItemsIndices.push(idx);
      } else {
        // Rollback lot inventory consumed by this rejected item
        for (const [, { lote, aDescontar }] of tempLotDecrements) {
          lote.restante = round3Decimals(lote.restante + aDescontar);
        }
        costoPorItem[idx] = 0;
        droppedItemsIndices.push(idx);
      }
    } else {
      // Standard whole-order mode: accumulate all decrements
      for (const [lotKey, { lote, item_id, aDescontar }] of tempLotDecrements) {
        const acum = lotDecrementsMap.get(lotKey) ?? {
          id: lote.id,
          lote_id: lote.lote_id,
          item_id,
          costo_unit: lote.costo_unit,
          total: 0,
        };
        acum.total = round3Decimals(acum.total + aDescontar);
        lotDecrementsMap.set(lotKey, acum);
      }

      for (const [insumoKey, qty] of tempInventarioDecrements) {
        inventarioDecrementsMap.set(
          insumoKey,
          round3Decimals((inventarioDecrementsMap.get(insumoKey) ?? 0) + qty)
        );
      }

      costoPorItem[idx] = round3Decimals(costoAcumuladoDelItem);
      successfulItemsIndices.push(idx);
    }
  }

  const insumosSinStock = [...insumosSinStockSet].map((id) => BigInt(id));

  // If allowPartialDrop is true and all items were dropped, throw standard error
  if (allowPartialDrop && successfulItemsIndices.length === 0) {
    throw new InsufficientStockError(
      'No hay suficiente stock para preparar ningún item de esta actualización.',
      insumosSinStock
    );
  }

  // If throwOnShortage is requested in whole-order mode and there is insufficient stock
  if (!allowPartialDrop && insumosSinStock.length > 0 && options?.throwOnShortage) {
    throw new InsufficientStockError(
      `Stock insuficiente para preparar el pedido. Insumos faltantes: ${insumosSinStock.join(', ')}`,
      insumosSinStock
    );
  }

  // Sort lot decrements deterministically by BigInt(id) ASC (INV-1)
  const lotDecrements = Array.from(lotDecrementsMap.values())
    .filter((d) => d.total > 0)
    .sort((a, b) => compareBigIntAsc(a.id, b.id));

  // Sort inventario decrements deterministically by BigInt(item_id) ASC (INV-2)
  const inventarioDecrements = Array.from(inventarioDecrementsMap.entries())
    .map(([itemIdStr, total]) => ({
      item_id: BigInt(itemIdStr),
      total: round3Decimals(total),
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => compareBigIntAsc(a.item_id, b.item_id));

  return {
    lotDecrements,
    inventarioDecrements,
    costoPorItem,
    successfulItemsIndices,
    droppedItemsIndices,
    insumosSinStock,
  };
}

/**
 * Applies sorted lot and inventory decrements inside a transaction:
 * 1. Sorts lot decrements by id ASC (INV-1)
 * 2. Decrements stockLoteSucursal with atomic gte guard, throwing if count === 0 (INV-4)
 * 3. Batch creates Kardex Salida movements in movimientoInventario
 * 4. Sorts inventory decrements by item_id ASC (INV-2)
 * 5. Decrements inventarioSucursal in sorted order
 */
export async function applySortedStockDecrements(
  tx: Prisma.TransactionClient | any,
  sucursalId: bigint | string | number,
  lotDecrements: LotDecrement[],
  inventarioDecrements: InventarioDecrement[],
  referencia: string,
  empleadoId: bigint
): Promise<void> {
  const sucursalBigInt = BigInt(sucursalId);

  // 1. Sort lot decrements by id ASC (INV-1)
  const sortedLots = [...lotDecrements].sort((a, b) => compareBigIntAsc(a.id, b.id));

  // 2. Decrement lot stock with atomic gte guard (INV-4)
  for (const lote of sortedLots) {
    const roundedTotal = round3Decimals(lote.total);
    if (roundedTotal <= 0) continue;

    const resultado = await tx.stockLoteSucursal.updateMany({
      where: { id: lote.id, cantidad: { gte: roundedTotal } },
      data: { cantidad: { decrement: roundedTotal } },
    });

    if (resultado.count === 0) {
      throw new Error(
        'Stock insuficiente: otro pedido consumió el inventario simultáneamente, intenta de nuevo'
      );
    }
  }

  // 3. Batch create kardex exit movements
  if (sortedLots.length > 0) {
    await tx.movimientoInventario.createMany({
      data: sortedLots.map((lote) => ({
        sucursal_id: sucursalBigInt,
        item_id: lote.item_id,
        lote_id: lote.lote_id,
        empleado_id: empleadoId,
        tipo: 'Salida' as const,
        motivo: 'Venta' as const,
        cantidad: round3Decimals(lote.total),
        costo_unit: lote.costo_unit,
        referencia: referencia.slice(0, 64),
      })),
    });
  }

  // 4. Sort inventory decrements by item_id ASC (INV-2)
  const sortedInventario = [...inventarioDecrements].sort((a, b) =>
    compareBigIntAsc(a.item_id, b.item_id)
  );

  // 5. Decrement inventory stock
  for (const inv of sortedInventario) {
    const roundedTotal = round3Decimals(inv.total);
    if (roundedTotal <= 0) continue;

    await tx.inventarioSucursal.updateMany({
      where: { sucursal_id: sucursalBigInt, item_id: inv.item_id },
      data: { stock: { decrement: roundedTotal } },
    });
  }
}

export interface MovimientoConsumo {
  sucursal_id?: bigint | string | number;
  item_id: bigint | string | number;
  lote_id?: bigint | string | number | null;
  cantidad: number | string | { toString(): string };
  costo_unit?: number | string | { toString(): string } | null;
}

/**
 * Reverses stock previously consumed by an order during order edition:
 * 1. Groups and consolidates consumptions by lote_id and item_id
 * 2. Sorts lot restorations by BigInt(lote_id) ASC (INV-1)
 * 3. Upserts stockLoteSucursal in sorted order
 * 4. Batch creates Kardex Entrada reversal movements in movimientoInventario
 * 5. Sorts inventory restorations by BigInt(item_id) ASC (INV-2)
 * 6. Increments inventarioSucursal in sorted order
 */
export async function applySortedStockRestorations(
  tx: Prisma.TransactionClient | any,
  sucursalId: bigint | string | number,
  consumos: MovimientoConsumo[],
  referencia: string,
  empleadoId: bigint
): Promise<void> {
  const sucursalBigInt = BigInt(sucursalId);

  // 1. Group and consolidate consumptions by lote_id and item_id
  const lotRestorationsMap = new Map<string, { lote_id: bigint; total: number }>();
  const itemRestorationsMap = new Map<string, { item_id: bigint; total: number }>();

  for (const mov of consumos) {
    const cantidad = round3Decimals(Number(mov.cantidad));
    if (cantidad <= 0) continue;

    if (mov.lote_id !== null && mov.lote_id !== undefined) {
      const loteIdBig = BigInt(mov.lote_id);
      const loteKey = loteIdBig.toString();
      const acum = lotRestorationsMap.get(loteKey) ?? { lote_id: loteIdBig, total: 0 };
      acum.total = round3Decimals(acum.total + cantidad);
      lotRestorationsMap.set(loteKey, acum);
    }

    const itemIdBig = BigInt(mov.item_id);
    const itemKey = itemIdBig.toString();
    const itemAcum = itemRestorationsMap.get(itemKey) ?? { item_id: itemIdBig, total: 0 };
    itemAcum.total = round3Decimals(itemAcum.total + cantidad);
    itemRestorationsMap.set(itemKey, itemAcum);
  }

  // 2. Sort lot restorations by BigInt(lote_id) ASC (INV-1)
  const sortedLotRestorations = Array.from(lotRestorationsMap.values())
    .filter((r) => r.total > 0)
    .sort((a, b) => compareBigIntAsc(a.lote_id, b.lote_id));

  // 3. Upsert stockLoteSucursal in sorted order
  for (const rest of sortedLotRestorations) {
    await tx.stockLoteSucursal.upsert({
      where: {
        sucursal_id_lote_id: {
          sucursal_id: sucursalBigInt,
          lote_id: rest.lote_id,
        },
      },
      update: { cantidad: { increment: rest.total } },
      create: {
        sucursal_id: sucursalBigInt,
        lote_id: rest.lote_id,
        cantidad: rest.total,
      },
    });
  }

  // 4. Batch create reversal movements
  if (consumos.length > 0) {
    await tx.movimientoInventario.createMany({
      data: consumos.map((mov) => ({
        sucursal_id: sucursalBigInt,
        item_id: BigInt(mov.item_id),
        lote_id: mov.lote_id !== null && mov.lote_id !== undefined ? BigInt(mov.lote_id) : null,
        empleado_id: empleadoId,
        tipo: 'Entrada' as const,
        motivo: 'Ajuste' as const,
        cantidad: round3Decimals(Number(mov.cantidad)),
        costo_unit:
          mov.costo_unit !== null && mov.costo_unit !== undefined ? Number(mov.costo_unit) : null,
        referencia: referencia.slice(0, 64),
      })),
    });
  }

  // 5. Sort inventory restorations by BigInt(item_id) ASC (INV-2)
  const sortedItemRestorations = Array.from(itemRestorationsMap.values())
    .filter((r) => r.total > 0)
    .sort((a, b) => compareBigIntAsc(a.item_id, b.item_id));

  // 6. Update inventory in sorted order
  for (const rest of sortedItemRestorations) {
    await tx.inventarioSucursal.updateMany({
      where: { sucursal_id: sucursalBigInt, item_id: rest.item_id },
      data: { stock: { increment: rest.total } },
    });
  }
}

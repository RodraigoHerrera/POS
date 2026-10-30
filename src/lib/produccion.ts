import { Prisma } from '@prisma/client';
import { calculateFEFODeductions } from '@/lib/fefo-logic';
import { runWithRetry } from '@/lib/transactionRetry';
import { requireEmpleado, esRespuestaError, TokenCookieReader } from '@/lib/auth';
import { ValidationError, parsePositiveBigInt } from '@/lib/validation';

export type ProductionBatchResult = {
  success: boolean;
  message: string;
  newLotId?: string;
};

export interface EntradaProduccion {
  recetaId: bigint;
  cantidad: Prisma.Decimal;
}

export interface ParametrosProduccionTx extends EntradaProduccion {
  sucursalId: bigint;
  empleadoId: bigint;
}

/**
 * Valida el cuerpo enviado por el cliente. La sucursal nunca se toma de aquí:
 * siempre proviene de la sesión del empleado.
 */
export function validarEntradaProduccion(body: unknown): EntradaProduccion {
  const raw = (body ?? {}) as Record<string, unknown>;
  const recetaId = parsePositiveBigInt(raw.recipeId, 'Receta');

  const cantidadRaw = raw.quantity;
  const cantidadNum =
    typeof cantidadRaw === 'number' ? cantidadRaw
    : typeof cantidadRaw === 'string' && cantidadRaw.trim() !== '' ? Number(cantidadRaw)
    : Number.NaN;
  if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
    throw new ValidationError('La cantidad debe ser un número mayor a 0', 'quantity');
  }

  return { recetaId, cantidad: new Prisma.Decimal(String(cantidadRaw)) };
}

/**
 * Solo los items de preparación se producen por lote. Los vendibles ya
 * descuentan su receta al venderse (caja/registrarPedido); producirlos
 * duplicaría el consumo de insumos.
 */
export function esItemProducible(tipo: string): boolean {
  return tipo === 'prep';
}

type DecimalNullable = Prisma.Decimal | null | undefined;

export interface ParametrosCantidadInsumo {
  cantidadProducir: Prisma.Decimal;
  rendimiento: DecimalNullable;
  mermaPctReceta: DecimalNullable;
  cantidadInsumo: Prisma.Decimal;
  mermaPctInsumo: DecimalNullable;
}

function factorMerma(pct: DecimalNullable, donde: string): Prisma.Decimal {
  const factor = new Prisma.Decimal(1).sub((pct ?? new Prisma.Decimal(0)).div(100));
  if (factor.lessThanOrEqualTo(0)) {
    throw new Error(`La merma ${donde} es ${pct}% (>= 100%); revise la receta`);
  }
  return factor;
}

/**
 * Cantidad bruta de un insumo para producir `cantidadProducir` unidades.
 * Misma fórmula que la explosión del MRP (src/lib/mrp/explosion.ts), salvo
 * que una merma >= 100% se rechaza en lugar de recortarse.
 */
export function calcularCantidadInsumo({
  cantidadProducir,
  rendimiento,
  mermaPctReceta,
  cantidadInsumo,
  mermaPctInsumo,
}: ParametrosCantidadInsumo): Prisma.Decimal {
  const rinde = rendimiento && rendimiento.gt(0) ? rendimiento : new Prisma.Decimal(1);
  const lotesReceta = cantidadProducir.div(rinde).div(factorMerma(mermaPctReceta, 'de la receta'));
  return lotesReceta.mul(cantidadInsumo).div(factorMerma(mermaPctInsumo, 'del insumo'));
}

export interface InsumoProduccionVista {
  itemId: string;
  nombre: string;
  unidad: string;
  /** Cantidad del insumo por cada unidad producida (rendimiento y merma aplicados). */
  porUnidad: number;
  disponible: number;
  costoUnit: number;
}

export interface RecetaProduccionVista {
  id: string;
  nombre: string;
  unidad: string;
  vidaUtilDias: number | null;
  insumos: InsumoProduccionVista[];
  error: string | null;
}

interface RecetaParaVista {
  id: bigint;
  rendimiento: Prisma.Decimal;
  merma_pct: DecimalNullable;
  item_vendible: { nombre: string; unidad_code: string; vida_util_dias: number | null };
  items: Array<{
    item_insumo_id: bigint;
    cantidad: Prisma.Decimal;
    merma_pct: DecimalNullable;
    item_insumo: { nombre: string; unidad_code: string };
  }>;
}

/**
 * Modelo de la página de producción. La cantidad requerida es lineal en lo
 * que se produce, así que basta con el factor por unidad calculado con la
 * misma fórmula que la transacción; el cliente solo lo multiplica.
 */
export function prepararRecetasProduccion(
  recetas: RecetaParaVista[],
  stockPorInsumo: Map<string, Prisma.Decimal>,
  costoPorInsumo: Map<string, Prisma.Decimal>
): RecetaProduccionVista[] {
  return recetas.map((receta) => {
    const base = {
      id: receta.id.toString(),
      nombre: receta.item_vendible.nombre,
      unidad: receta.item_vendible.unidad_code,
      vidaUtilDias: receta.item_vendible.vida_util_dias,
    };

    if (receta.items.length === 0) {
      return { ...base, insumos: [], error: 'La receta no tiene insumos' };
    }

    try {
      const insumos = receta.items.map((ri) => {
        const clave = ri.item_insumo_id.toString();
        return {
          itemId: clave,
          nombre: ri.item_insumo.nombre,
          unidad: ri.item_insumo.unidad_code,
          porUnidad: calcularCantidadInsumo({
            cantidadProducir: new Prisma.Decimal(1),
            rendimiento: receta.rendimiento,
            mermaPctReceta: receta.merma_pct,
            cantidadInsumo: ri.cantidad,
            mermaPctInsumo: ri.merma_pct,
          }).toNumber(),
          disponible: stockPorInsumo.get(clave)?.toNumber() ?? 0,
          costoUnit: costoPorInsumo.get(clave)?.toNumber() ?? 0,
        };
      });
      return { ...base, insumos, error: null };
    } catch (error: any) {
      return { ...base, insumos: [], error: error.message };
    }
  });
}

interface LoteOrdenable {
  lote: { id: bigint; fecha_caducidad: Date | null; creado_en: Date };
}

interface LoteStockProduccion extends LoteOrdenable {
  cantidad: Prisma.Decimal;
  lote: LoteOrdenable['lote'] & { costo_unit: Prisma.Decimal };
}

/**
 * Orden FEFO: primero el que vence antes; los lotes sin caducidad van al
 * final (MySQL los ordena primero en ASC). Igual que simularConsumoFEFO.
 */
export function ordenarLotesFEFO<T extends LoteOrdenable>(lotes: T[]): T[] {
  const caducidad = (l: T) => l.lote.fecha_caducidad?.getTime() ?? Infinity;
  return [...lotes].sort((a, b) =>
    caducidad(a) - caducidad(b) ||
    a.lote.creado_en.getTime() - b.lote.creado_en.getTime() ||
    (a.lote.id < b.lote.id ? -1 : a.lote.id > b.lote.id ? 1 : 0)
  );
}

/**
 * Executes a production batch, deducting raw materials via FEFO,
 * creating a new lot, and logging inventory movements.
 */
export async function ejecutarProduccionTx(
  tx: Prisma.TransactionClient | any,
  { sucursalId, empleadoId, recetaId, cantidad: batchQty }: ParametrosProduccionTx
) {
  // 1. Fetch recipe and ingredients
  const recipe = await tx.receta.findUnique({
    where: { id: recetaId },
    include: { items: true },
  });

  if (!recipe) {
    throw new Error(`Receta con ID ${recetaId} no encontrada`);
  }

  const outputItem = await tx.item.findUnique({
    where: { id: recipe.item_vendible_id }
  });
  if (!outputItem) {
    throw new Error('El item de salida de la receta no existe');
  }
  if (!esItemProducible(outputItem.tipo)) {
    throw new Error('Solo se pueden producir items de preparación');
  }

  let totalBatchCost = new Prisma.Decimal(0);
  const usedIngredients: Array<{ insumoId: bigint, loteId: bigint, cant: Prisma.Decimal }> = [];

  // 2. Process FEFO deductions
  for (const ingredient of recipe.items) {
    const requiredTotal = calcularCantidadInsumo({
      cantidadProducir: batchQty,
      rendimiento: recipe.rendimiento,
      mermaPctReceta: recipe.merma_pct,
      cantidadInsumo: ingredient.cantidad,
      mermaPctInsumo: ingredient.merma_pct,
    });

    const availableLots = ordenarLotesFEFO<LoteStockProduccion>(await tx.stockLoteSucursal.findMany({
      where: {
        sucursal_id: sucursalId,
        lote: { item_id: ingredient.item_insumo_id },
        cantidad: { gt: 0 },
      },
      include: { lote: true },
    }));

    const fefoLots = availableLots.map((lotInfo: any) => ({
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
      const lotInfo = availableLots.find((l: any) => l.lote.id === deduction.lotId);
      const lotUnitCost = lotInfo?.lote.costo_unit || new Prisma.Decimal(0);

      totalBatchCost = totalBatchCost.add(lotUnitCost.mul(decDeducted));
      usedIngredients.push({
        insumoId: ingredient.item_insumo_id,
        loteId: deduction.lotId as bigint,
        cant: decDeducted,
      });

      // Conditional decrement: fails if a concurrent sale consumed the lot
      // after it was read (same guard as mermas, INV-4).
      const { count } = await tx.stockLoteSucursal.updateMany({
        where: {
          sucursal_id: sucursalId,
          lote_id: deduction.lotId as bigint,
          cantidad: { gte: decDeducted },
        },
        data: { cantidad: { decrement: decDeducted } }
      });
      if (count === 0) {
        throw new Error(
          `Stock insuficiente: el lote ${deduction.lotId} cambió durante la producción, intente de nuevo`
        );
      }

      // Update inventarioSucursal
      await tx.inventarioSucursal.update({
        where: {
          sucursal_id_item_id: {
            sucursal_id: sucursalId,
            item_id: ingredient.item_insumo_id,
          }
        },
        data: { stock: { decrement: decDeducted } }
      });

      // Log negative movement
      await tx.movimientoInventario.create({
        data: {
          sucursal_id: sucursalId,
          item_id: ingredient.item_insumo_id,
          lote_id: deduction.lotId as bigint,
          empleado_id: empleadoId,
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
      sucursal_id: sucursalId,
      lote_id: createdLot.id,
      cantidad: batchQty,
    }
  });

  // Update or create inventarioSucursal
  const claveSalida = { sucursal_id_item_id: { sucursal_id: sucursalId, item_id: recipe.item_vendible_id } };
  const existeSalida = await tx.inventarioSucursal.findUnique({ where: claveSalida });

  if (existeSalida) {
    // Increment first: the UPDATE locks the row and applies on its latest
    // version, so a concurrent sale is never overwritten. The re-read then
    // sees that locked version to recompute the average cost.
    await tx.inventarioSucursal.update({
      where: claveSalida,
      data: { stock: { increment: batchQty } }
    });
    const invSucursal = await tx.inventarioSucursal.findUnique({ where: claveSalida });

    // Average cost simplified logic
    const newTotalStock = invSucursal.stock;
    const stockPrevio = newTotalStock.sub(batchQty);
    const newTotalValue = stockPrevio.mul(invSucursal.costo_promedio).add(totalBatchCost);
    const newCostoPromedio = newTotalStock.gt(0) ? newTotalValue.div(newTotalStock) : new Prisma.Decimal(0);

    await tx.inventarioSucursal.update({
      where: claveSalida,
      data: { costo_promedio: newCostoPromedio }
    });
  } else {
    await tx.inventarioSucursal.create({
      data: {
        sucursal_id: sucursalId,
        item_id: recipe.item_vendible_id,
        stock: batchQty,
        costo_promedio: unitCost,
      }
    });
  }

  // 4. Log positive movement
  await tx.movimientoInventario.create({
    data: {
      sucursal_id: sucursalId,
      item_id: recipe.item_vendible_id,
      lote_id: createdLot.id,
      empleado_id: empleadoId,
      tipo: 'Entrada',
      motivo: 'Produccion',
      cantidad: batchQty,
      costo_unit: unitCost,
    }
  });

  // 5. Create Produccion log records
  const prodRecord = await tx.produccion.create({
    data: {
      sucursal_id: sucursalId,
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
}

/**
 * Punto de entrada de la server action: exige sesión de Administrador y
 * produce siempre en la sucursal de esa sesión.
 */
export async function ejecutarProduccion(
  body: unknown,
  cookieReader?: TokenCookieReader
): Promise<ProductionBatchResult> {
  const sesion = await requireEmpleado(['Administrador'], cookieReader);
  if (esRespuestaError(sesion)) {
    const { message } = await sesion.json();
    return { success: false, message };
  }

  let entrada: EntradaProduccion;
  try {
    entrada = validarEntradaProduccion(body);
  } catch (error: any) {
    return { success: false, message: error.message };
  }

  try {
    const newLotObj = await runWithRetry(
      (tx) => ejecutarProduccionTx(tx, {
        ...entrada,
        sucursalId: BigInt(sesion.sucursalId),
        empleadoId: BigInt(sesion.empleadoId),
      }),
      { timeoutMs: 15000 }
    );

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

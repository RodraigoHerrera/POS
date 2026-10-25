import { prisma } from "@/lib/db";

/**
 * Costo teórico = receta (BOM) × costo de referencia de cada insumo.
 * El costo de referencia es, por insumo:
 *   1. item.costo_estandar si está fijado (congelado, no se mueve con cada compra)
 *   2. si no, inventarioSucursal.costo_promedio (fallback automático)
 * Fijar un costo_estandar aísla la brecha real-vs-teórico de la variación de
 * precio de mercado, dejándola atribuible solo a causas operativas (merma,
 * sobre-porcionamiento). Sin fijarlo, el sistema sigue funcionando igual que
 * antes (cae a costo_promedio), así que no bloquea a nadie.
 */

export type FuenteCostoReferencia = "estandar" | "promedio";

export interface CostoReferenciaInsumo {
  costo: number;
  fuente: FuenteCostoReferencia;
}

export interface DetalleCostoTeoricoInsumo {
  itemInsumoId: string;
  cantidad: number;
  costoReferencia: number;
  fuente: FuenteCostoReferencia;
  costoTeorico: number;
}

/** Suma cantidad × costoReferencia para un set de insumos de receta ya resueltos. */
export function costoTeoricoDesdeRequerimientos(
  requerimientos: { insumoId: bigint; cantidadRequerida: number }[],
  costoReferenciaPorInsumo: Map<string, CostoReferenciaInsumo>
): number {
  return requerimientos.reduce((acc, { insumoId, cantidadRequerida }) => {
    const costo = costoReferenciaPorInsumo.get(insumoId.toString())?.costo ?? 0;
    return acc + cantidadRequerida * costo;
  }, 0);
}

/**
 * Costo de referencia por insumo en una sucursal: costo_estandar si está
 * fijado, si no costo_promedio actual. Una sola consulta a cada tabla para
 * todo el set de insumoIds.
 */
export async function obtenerCostoReferenciaPorInsumo(
  sucursalId: bigint,
  insumoIds: bigint[]
): Promise<Map<string, CostoReferenciaInsumo>> {
  if (insumoIds.length === 0) return new Map();

  const [items, inventarios] = await Promise.all([
    prisma.item.findMany({
      where: { id: { in: insumoIds } },
      select: { id: true, costo_estandar: true },
    }),
    prisma.inventarioSucursal.findMany({
      where: { sucursal_id: sucursalId, item_id: { in: insumoIds } },
      select: { item_id: true, costo_promedio: true },
    }),
  ]);

  const costoPromedioPorItem = new Map(
    inventarios.map((inv) => [inv.item_id.toString(), Number(inv.costo_promedio)])
  );

  const resultado = new Map<string, CostoReferenciaInsumo>();
  for (const item of items) {
    const key = item.id.toString();
    if (item.costo_estandar !== null) {
      resultado.set(key, { costo: Number(item.costo_estandar), fuente: "estandar" });
    } else {
      resultado.set(key, { costo: costoPromedioPorItem.get(key) ?? 0, fuente: "promedio" });
    }
  }
  return resultado;
}

/**
 * Costo teórico de UNA unidad del item vendible, en la sucursal dada, según
 * su receta vigente y el costo de referencia de cada insumo.
 * Pensado para mostrarse en /admin/recetas, fuera del flujo de venta.
 */
export async function calcularCostoTeoricoUnitario(
  itemVendibleId: bigint,
  sucursalId: bigint
): Promise<{ costoTeoricoUnitario: number; detalle: DetalleCostoTeoricoInsumo[] }> {
  const receta = await prisma.receta.findFirst({
    where: { item_vendible_id: itemVendibleId },
    include: { items: true },
  });

  if (!receta || receta.items.length === 0) {
    return { costoTeoricoUnitario: 0, detalle: [] };
  }

  const insumoIds = receta.items.map((ri) => ri.item_insumo_id);
  const costoReferenciaPorInsumo = await obtenerCostoReferenciaPorInsumo(sucursalId, insumoIds);

  const detalle: DetalleCostoTeoricoInsumo[] = receta.items.map((ri) => {
    const cantidad = Number(ri.cantidad);
    const referencia = costoReferenciaPorInsumo.get(ri.item_insumo_id.toString());
    const costoReferencia = referencia?.costo ?? 0;
    return {
      itemInsumoId: ri.item_insumo_id.toString(),
      cantidad,
      costoReferencia,
      fuente: referencia?.fuente ?? "promedio",
      costoTeorico: cantidad * costoReferencia,
    };
  });

  const costoTeoricoUnitario = detalle.reduce((acc, d) => acc + d.costoTeorico, 0);
  return { costoTeoricoUnitario, detalle };
}

// Helpers de acceso a datos para el módulo MRP. Mantiene las consultas Prisma
// fuera de la lógica pura (forecast/explosion/necesidad/ordenes) y fuera del
// endpoint orquestador, que ya tiene bastante con la orquestación.

import { prisma } from "@/lib/db";
import type { MapaRecetas, TipoItemReceta } from "./explosion";

/**
 * Carga recursivamente las recetas necesarias para explotar un conjunto de
 * items "padre" (vendibles o preps), siguiendo cada insumo tipo "prep" hasta
 * que no aparezcan preps nuevos sin cargar o se alcance el límite de niveles.
 */
export async function cargarRecetasRecursivo(idsIniciales: bigint[]): Promise<MapaRecetas> {
  const mapa: MapaRecetas = new Map();
  if (idsIniciales.length === 0) return mapa;

  let frontera = [...new Set(idsIniciales.map((id) => id.toString()))];
  let nivel = 0;

  while (frontera.length > 0 && nivel < 10) {
    const idsBigInt = frontera.map((id) => BigInt(id));
    const recetas = await prisma.receta.findMany({
      where: { item_vendible_id: { in: idsBigInt } },
      include: { items: { include: { item_insumo: { select: { id: true, tipo: true } } } } },
    });

    const siguienteFrontera: string[] = [];
    for (const r of recetas) {
      mapa.set(r.item_vendible_id.toString(), {
        rendimiento: Number(r.rendimiento),
        mermaPctReceta: Number(r.merma_pct ?? 0),
        insumos: r.items.map((ri) => ({
          itemInsumoId: ri.item_insumo_id.toString(),
          itemInsumoTipo: ri.item_insumo.tipo as TipoItemReceta,
          cantidad: Number(ri.cantidad),
          mermaPctRecetaItem: Number(ri.merma_pct ?? 0),
        })),
      });

      for (const ri of r.items) {
        const insumoId = ri.item_insumo_id.toString();
        if (ri.item_insumo.tipo === "prep" && !mapa.has(insumoId)) {
          siguienteFrontera.push(insumoId);
        }
      }
    }

    frontera = [...new Set(siguienteFrontera)];
    nivel++;
  }

  return mapa;
}

/** Ventas diarias por producto (sumadas por día) dentro de la sucursal, desde la fecha dada. */
export async function obtenerVentasDiariasPorProducto(
  sucursalId: bigint,
  desde: Date
): Promise<Map<string, Map<string, number>>> {
  const ventas = await prisma.historialVentas.findMany({
    where: { sucursal_id: sucursalId, fecha_venta: { gte: desde } },
    select: { producto_id: true, fecha_venta: true, cantidad: true },
  });

  const resultado = new Map<string, Map<string, number>>();
  for (const v of ventas) {
    const key = v.producto_id.toString();
    const dia = v.fecha_venta.toISOString().slice(0, 10);
    const porDia = resultado.get(key) ?? new Map<string, number>();
    porDia.set(dia, (porDia.get(dia) ?? 0) + v.cantidad);
    resultado.set(key, porDia);
  }
  return resultado;
}

/** Cantidad ya pedida pero no recibida (ordenCompra en estado "Enviada") por insumo. */
export async function obtenerEntradasProgramadas(
  sucursalId: bigint,
  itemIds: bigint[]
): Promise<Map<string, number>> {
  const resultado = new Map<string, number>();
  if (itemIds.length === 0) return resultado;

  const items = await prisma.ordenCompraItem.findMany({
    where: {
      item_id: { in: itemIds },
      orden_compra: { sucursal_id: sucursalId, estado: "Enviada" },
    },
    select: { item_id: true, cantidad: true },
  });

  for (const it of items) {
    const key = it.item_id.toString();
    resultado.set(key, (resultado.get(key) ?? 0) + Number(it.cantidad));
  }
  return resultado;
}

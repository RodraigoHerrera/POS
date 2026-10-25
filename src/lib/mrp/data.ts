// Helpers de acceso a datos para el módulo MRP. Mantiene las consultas Prisma
// fuera de la lógica pura (forecast/explosion/necesidad/ordenes) y fuera del
// endpoint orquestador, que ya tiene bastante con la orquestación.

import { prisma } from "@/lib/db";
import { agruparFilasVentas, type FilaVentaDiaria } from "./ventasDiarias";
import { obtenerZonaMrp, offsetSegundos } from "./zonaHoraria";
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

/**
 * Ventas diarias por producto dentro de la sucursal, desde la fecha dada,
 * agregadas en SQL por dia local de negocio (zona `tz`, env MRP_TZ).
 *
 * `fecha_venta` se guarda en UTC; se desplaza con un desfase numerico en
 * segundos (no CONVERT_TZ, que exige las tablas de zonas horarias cargadas en
 * MySQL). El desfase es el vigente hoy: exacto para zonas sin DST (La Paz).
 * Todos los valores van parametrizados.
 */
export async function obtenerVentasDiariasPorProducto(
  sucursalId: bigint,
  desde: Date,
  tz: string = obtenerZonaMrp()
): Promise<Map<string, Map<string, number>>> {
  const offset = offsetSegundos(new Date(), tz);
  const filas = await prisma.$queryRaw<FilaVentaDiaria[]>`
    SELECT producto_id,
           DATE_FORMAT(DATE_ADD(fecha_venta, INTERVAL ${offset} SECOND), '%Y-%m-%d') AS dia,
           SUM(cantidad) AS total
    FROM historialVentas
    WHERE sucursal_id = ${sucursalId}
      AND fecha_venta >= ${desde}
    GROUP BY producto_id, dia
  `;
  return agruparFilasVentas(filas);
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

/** Stock actual en la sucursal de los items dados (usado para netear preps). */
export async function obtenerStockPorItem(
  sucursalId: bigint,
  itemIds: bigint[]
): Promise<Map<string, number>> {
  const resultado = new Map<string, number>();
  if (itemIds.length === 0) return resultado;

  const filas = await prisma.inventarioSucursal.findMany({
    where: { sucursal_id: sucursalId, item_id: { in: itemIds } },
    select: { item_id: true, stock: true },
  });
  for (const f of filas) resultado.set(f.item_id.toString(), Number(f.stock));
  return resultado;
}

/** Nombres de items por id (solo para mensajes legibles). */
export async function obtenerNombresItems(itemIds: bigint[]): Promise<Map<string, string>> {
  const resultado = new Map<string, string>();
  if (itemIds.length === 0) return resultado;
  const filas = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, nombre: true },
  });
  for (const f of filas) resultado.set(f.id.toString(), f.nombre);
  return resultado;
}

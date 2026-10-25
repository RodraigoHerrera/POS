// Agrupa las necesidades netas (> 0) por proveedor preferido del insumo, para
// armar las ordenCompra/ordenCompraItem en estado Borrador. Los insumos sin
// proveedor asignado NO generan una orden automática: quedan en un bucket
// separado para que el Jefe de Sucursal lo resuelva a mano (asignar proveedor
// o crear la OC manualmente).

export interface InsumoParaOrden {
  itemId: string;
  necesidadNeta: number;
  proveedorId: string | null;
  costoUnitEstimado: number;
  fechaSugeridaEmision: Date;
  /** unidad_code del item; define si la cantidad a pedir debe ser entera. */
  unidadCode?: string | null;
}

export interface OrdenCompraBorrador {
  proveedorId: string;
  fechaSugeridaEmision: Date;
  items: { itemId: string; cantidad: number; costoUnit: number }[];
  total: number;
}

export interface AgrupacionOrdenes {
  ordenes: OrdenCompraBorrador[];
  sinProveedor: { itemId: string; necesidadNeta: number }[];
}

// Unidades que se cuentan en piezas completas (no se compra "2.1 cajas").
// Las demás (kg, g, L, ml, litro, ...) conservan decimales (3, como la columna).
const UNIDADES_ENTERAS = new Set([
  "u", "und", "unid", "unidad", "unidades",
  "caja", "cajas", "paquete", "paquetes", "pza", "pieza", "piezas",
]);

export function esUnidadEntera(unidadCode: string | null | undefined): boolean {
  return !!unidadCode && UNIDADES_ENTERAS.has(unidadCode.trim().toLowerCase());
}

/** Cantidad a pedir: hacia arriba al entero para unidades contadas; igual en el resto. */
export function cantidadOrden(necesidadNeta: number, unidadCode: string | null | undefined): number {
  return esUnidadEntera(unidadCode) ? Math.ceil(necesidadNeta - 1e-9) : necesidadNeta;
}

export function agruparPorProveedor(insumos: InsumoParaOrden[]): AgrupacionOrdenes {
  const porProveedor = new Map<string, InsumoParaOrden[]>();
  const sinProveedor: AgrupacionOrdenes["sinProveedor"] = [];

  for (const insumo of insumos) {
    if (insumo.necesidadNeta <= 0) continue;

    if (!insumo.proveedorId) {
      sinProveedor.push({ itemId: insumo.itemId, necesidadNeta: insumo.necesidadNeta });
      continue;
    }

    const lista = porProveedor.get(insumo.proveedorId) ?? [];
    lista.push(insumo);
    porProveedor.set(insumo.proveedorId, lista);
  }

  const ordenes: OrdenCompraBorrador[] = [...porProveedor.entries()].map(
    ([proveedorId, lista]) => {
      const items = lista.map((i) => ({
        itemId: i.itemId,
        cantidad: cantidadOrden(i.necesidadNeta, i.unidadCode),
        costoUnit: i.costoUnitEstimado,
      }));
      const total = items.reduce((acc, it) => acc + it.cantidad * it.costoUnit, 0);
      const fechaSugeridaEmision = lista.reduce(
        (min, i) => (i.fechaSugeridaEmision < min ? i.fechaSugeridaEmision : min),
        lista[0].fechaSugeridaEmision
      );
      return { proveedorId, fechaSugeridaEmision, items, total };
    }
  );

  return { ordenes, sinProveedor };
}

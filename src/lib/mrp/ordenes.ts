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
        cantidad: i.necesidadNeta,
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

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { errorResponse } from '@/lib/apiError';
import { costoTeoricoDesdeRequerimientos, obtenerCostoReferenciaPorInsumo } from '@/lib/costeo';
import { simularConsumoFEFO, applySortedStockDecrements, applySortedStockRestorations } from '@/lib/fefo';
import { runWithRetry } from '@/lib/transactionRetry';
import { validateOrderEditState, validateSimulationResults } from '@/lib/caja';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pedidoId, items, mesa = "Mostrador", cliente = "Cliente General" } = body;

    if (!pedidoId) {
      return NextResponse.json({ error: 'Falta pedidoId' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
    }

    for (const itemPedido of items) {
      const cantidad = Number(itemPedido?.cantidad);
      if (!itemPedido?.producto_id || !Number.isInteger(cantidad) || cantidad <= 0) {
        return NextResponse.json(
          { error: 'Cada item requiere producto_id y una cantidad entera mayor a 0' },
          { status: 400 }
        );
      }
    }

    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
    const tokenEmpleado = cookieStore.get("tokenEmpleado")?.value;

    if (!tokenSucursal || !tokenEmpleado) {
      return NextResponse.json({ error: 'Sesión no válida o expirada' }, { status: 401 });
    }

    let sucursalId, empleadoId;
    try {
      const payloadSucursal = await jwtVerify(tokenSucursal, secret);
      sucursalId = (payloadSucursal.payload as any)?.sucursalId || (payloadSucursal.payload as any)?.id;

      const payloadEmpleado = await jwtVerify(tokenEmpleado, secret);
      empleadoId = (payloadEmpleado.payload as any)?.empleadoId || (payloadEmpleado.payload as any)?.id;
    } catch (e) {
      return NextResponse.json({ error: 'Error verificando tokens' }, { status: 403 });
    }

    const sucursalBigInt = BigInt(sucursalId);
    const pedidoBigInt = BigInt(pedidoId);

    // PRE-CALCULATION for new items
    const productoIds: bigint[] = [...new Set<bigint>(items.map((i: any) => BigInt(i.producto_id)))];
    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, item_inventario_id: true, precio: true, estado: true, nombre: true },
    });
    const productoMap = new Map(productos.map((p) => [p.id.toString(), p]));

    for (const itemPedido of items) {
      const producto = productoMap.get(String(BigInt(itemPedido.producto_id)));
      if (!producto) {
        return NextResponse.json({ error: `Producto ${itemPedido.producto_id} no existe` }, { status: 400 });
      }
      if ((producto.estado ?? '').toLowerCase() !== 'activo') {
        return NextResponse.json({ error: `El producto "${producto.nombre}" no está disponible para la venta` }, { status: 409 });
      }
    }

    const itemInventarioIds = [...new Set(productos.map((p) => p.item_inventario_id).filter((id): id is bigint => id !== null))];
    const recetas = await prisma.receta.findMany({
      where: { item_vendible_id: { in: itemInventarioIds } },
      include: { items: true },
    });
    const recetaMap = new Map(recetas.map((r) => [r.item_vendible_id.toString(), r.items]));

    const extraIds: bigint[] = [...new Set<bigint>(items.flatMap((i: any) => (i.extras ?? []).map((e: any) => BigInt(e))))];
    const modificadores = extraIds.length > 0 ? await prisma.modificadorProducto.findMany({
      where: { id: { in: extraIds } },
      include: { item_insumo: { select: { id: true, nombre: true } } },
    }) : [];
    const modificadorMap = new Map(modificadores.map((m) => [m.id.toString(), m]));

    const itemInventarioIdPorItem: (bigint | null)[] = items.map((itemPedido: any) =>
      productoMap.get(String(BigInt(itemPedido.producto_id)))?.item_inventario_id ?? null
    );

    const extrasValidosPorItem = items.map((itemPedido: any, idx: number) => {
      const itemInventarioId = itemInventarioIdPorItem[idx];
      return (itemPedido.extras ?? [])
        .map((extraId: any) => modificadorMap.get(String(extraId)))
        .filter((m: any) => m && itemInventarioId && m.item_vendible_id.toString() === itemInventarioId.toString());
    });

    const precioUnitPorItem: number[] = items.map((itemPedido: any) => Number(productoMap.get(String(BigInt(itemPedido.producto_id)))!.precio));
    const subtotalPorItem: number[] = items.map((itemPedido: any, idx: number) => {
      const extraPrecioUnitario = extrasValidosPorItem[idx].reduce((acc: number, m: any) => acc + Number(m.precio), 0);
      return (precioUnitPorItem[idx] + extraPrecioUnitario) * Number(itemPedido.cantidad);
    });

    interface Requerimiento { insumoId: bigint; cantidadRequerida: number }
    const requerimientosPorItem: Requerimiento[][] = items.map((itemPedido: any, idx: number) => {
      const itemInventarioId = itemInventarioIdPorItem[idx];
      const recetaItems = itemInventarioId ? recetaMap.get(itemInventarioId.toString()) : undefined;
      const deRecetas: Requerimiento[] = (recetaItems ?? []).map((ingrediente) => ({
        insumoId: ingrediente.item_insumo_id,
        cantidadRequerida: Number(ingrediente.cantidad) * Number(itemPedido.cantidad),
      }));
      const deExtras: Requerimiento[] = extrasValidosPorItem[idx].map((m: any) => ({
        insumoId: m.item_insumo_id,
        cantidadRequerida: Number(m.delta_cantidad) * Number(itemPedido.cantidad),
      }));
      return [...deRecetas, ...deExtras];
    });

    const insumoIds: bigint[] = [...new Set<bigint>(requerimientosPorItem.flat().map((r) => r.insumoId))];
    const costoReferenciaPorInsumo = await obtenerCostoReferenciaPorInsumo(sucursalBigInt, insumoIds);
    const costoTeoricoPorItem: number[] = items.map((_, idx) =>
      costoTeoricoDesdeRequerimientos(requerimientosPorItem[idx], costoReferenciaPorInsumo)
    );

    const resultado = await runWithRetry(async (tx) => {
      // 1. PESSIMISTIC ROW LOCK & CLOSED STATE GUARD (INV-SEC04-3, INV-SEC04-1)
      const lockedOrders = await tx.$queryRaw<Array<{ id: bigint; sucursal_id: bigint; estado: string; observaciones: string | null }>>`
        SELECT id, sucursal_id, estado, observaciones
        FROM \`pedido\`
        WHERE id = ${pedidoBigInt} AND sucursal_id = ${sucursalBigInt}
        FOR UPDATE
      `;
      const lockedOrder = lockedOrders[0];

      if (!lockedOrder) {
        throw new Error("PEDIDO_NOT_FOUND");
      }

      validateOrderEditState(lockedOrder);

      const isCorrection = lockedOrder.estado === 'COMANDADO';
      const newState = lockedOrder.estado;

      // 2. REVERSE PREVIOUS STOCK (ordenado determinísticamente por lote_id e item_id)
      const consumos = await tx.movimientoInventario.findMany({
        where: {
          sucursal_id: sucursalBigInt,
          tipo: "Salida",
          motivo: "Venta",
          referencia: `Pedido #${pedidoBigInt}`,
        },
      });

      await applySortedStockRestorations(
        tx,
        sucursalBigInt,
        consumos,
        `Reversa Edición Pedido #${pedidoBigInt}`
      );

      // 3. DELETE OLD ITEMS
      await tx.pedidoItemExtra.deleteMany({
        where: { pedido_item: { pedido_id: pedidoBigInt } },
      });
      await tx.pedidoItem.deleteMany({
        where: { pedido_id: pedidoBigInt },
      });

      // 4. APPLY NEW STOCK (SIMULATE FEFO AND WRITE)
      const lotesDisponibles = insumoIds.length > 0 ? await tx.stockLoteSucursal.findMany({
        where: { sucursal_id: sucursalBigInt, lote: { item_id: { in: insumoIds } }, cantidad: { gt: 0 } },
        include: { lote: true },
        orderBy: { lote: { fecha_caducidad: 'asc' } },
      }) : [];

      const simulation = simularConsumoFEFO(lotesDisponibles, requerimientosPorItem, {
        allowPartialDrop: true,
      });

      // CRITICAL GUARD INV-SEC04-4: Fail fast and non-destructively abort if zero items fulfilled
      validateSimulationResults(simulation.successfulItemsIndices.length);

      const droppedItems = simulation.droppedItemsIndices.map((idx) => ({
        ...items[idx],
        index: idx,
        productName: productoMap.get(String(BigInt(items[idx].producto_id)))?.nombre,
      }));

      let nuevoTotal = 0;
      for (const idx of simulation.successfulItemsIndices) {
        nuevoTotal += subtotalPorItem[idx];
      }

      // 5. UPDATE PEDIDO WITH STATE IMMUTABILITY GUARD
      const observacionesBase = lockedOrder.observaciones || '';
      const observacionesUpdate = isCorrection 
        ? `${observacionesBase}\n[Corrección por edición - ${new Date().toLocaleString()}]`.trim()
        : observacionesBase;

      const updateResult = await tx.pedido.updateMany({
        where: {
          id: pedidoBigInt,
          sucursal_id: sucursalBigInt,
          estado: { notIn: ['PAGADO', 'ANULADO'] }
        },
        data: {
          mesa: mesa,
          cliente_nombre: cliente,
          estado: newState as any,
          total: nuevoTotal,
          observaciones: observacionesUpdate
        }
      });

      if (updateResult.count === 0) {
        throw new Error("CONCURRENT_STATE_CHANGE");
      }

      // 6. INSERT NEW ITEMS
      for (const idx of simulation.successfulItemsIndices) {
        const itemPedido = items[idx];
        await tx.pedidoItem.create({
          data: {
            pedido_id: pedidoBigInt,
            producto_id: BigInt(itemPedido.producto_id),
            cantidad: Number(itemPedido.cantidad),
            precio_unit: precioUnitPorItem[idx],
            subtotal: subtotalPorItem[idx],
            notas: itemPedido.notas,
            costo_real: simulation.costoPorItem[idx],
            costo_teorico: costoTeoricoPorItem[idx],
            extras: {
              create: extrasValidosPorItem[idx].map((m: any) => ({
                nombre: m.item_insumo.nombre,
                precio: m.precio,
                item_inv_id: m.item_insumo_id,
              })),
            },
          },
        });
      }

      // 7. DEDUCT STOCK IN DB (ordenado determinísticamente INV-1, INV-2)
      await applySortedStockDecrements(
        tx,
        sucursalBigInt,
        simulation.lotDecrements,
        simulation.inventarioDecrements,
        `Pedido #${pedidoBigInt}`
      );

      return { pedidoId: pedidoBigInt.toString(), total: nuevoTotal, droppedItems, isCorrection };
    }, { timeoutMs: 20000 });

    return NextResponse.json({
      success: true,
      pedidoId: resultado.pedidoId,
      total: resultado.total,
      droppedItems: resultado.droppedItems,
      isCorrection: resultado.isCorrection,
      message: 'Pedido actualizado'
    });

  } catch (error: any) {
    if (error?.message === "PEDIDO_NOT_FOUND" || error?.message === "Pedido no encontrado") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (
      error?.message === "PEDIDO_ALREADY_CLOSED" ||
      error?.message === "CONCURRENT_STATE_CHANGE" ||
      error?.message === "El pedido ya fue pagado o anulado y no puede ser editado."
    ) {
      return NextResponse.json({ error: "El pedido ya fue pagado o anulado y no puede ser editado." }, { status: 409 });
    }
    if (
      error?.message === "ALL_ITEMS_OUT_OF_STOCK" ||
      error?.message === "No hay suficiente stock para preparar ningún item de esta actualización."
    ) {
      return NextResponse.json({ error: "No hay suficiente stock para preparar ningún item de esta actualización." }, { status: 409 });
    }
    if (typeof error?.message === "string" && (error.message.startsWith("Stock insuficiente") || error.message.startsWith("No hay suficiente stock"))) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Error al actualizar el pedido");
  }
}

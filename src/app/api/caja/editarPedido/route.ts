import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { errorResponse } from '@/lib/apiError';
import { costoTeoricoDesdeRequerimientos, obtenerCostoReferenciaPorInsumo } from '@/lib/costeo';

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

    // Fetch existing order to check state
    const existingOrder = await prisma.pedido.findUnique({
      where: { id: pedidoBigInt, sucursal_id: sucursalBigInt },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (existingOrder.estado === 'PAGADO' || existingOrder.estado === 'ANULADO') {
      return NextResponse.json({ error: `El pedido está ${existingOrder.estado} y no puede ser editado.` }, { status: 409 });
    }

    const isCorrection = existingOrder.estado === 'COMANDADO';
    const newState = existingOrder.estado; // Preserve state (PENDIENTE or COMANDADO)

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

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. REVERSE PREVIOUS STOCK
      const consumos = await tx.movimientoInventario.findMany({
        where: {
          sucursal_id: sucursalBigInt,
          tipo: "Salida",
          motivo: "Venta",
          referencia: `Pedido #${pedidoBigInt}`,
        },
      });

      const incrementosPorInsumo = new Map<string, number>();
      for (const mov of consumos) {
        const cantidad = Number(mov.cantidad);
        if (mov.lote_id !== null) {
          await tx.stockLoteSucursal.upsert({
            where: { sucursal_id_lote_id: { sucursal_id: sucursalBigInt, lote_id: mov.lote_id } },
            update: { cantidad: { increment: cantidad } },
            create: { sucursal_id: sucursalBigInt, lote_id: mov.lote_id, cantidad },
          });
        }
        const key = mov.item_id.toString();
        incrementosPorInsumo.set(key, (incrementosPorInsumo.get(key) ?? 0) + cantidad);
      }

      if (consumos.length > 0) {
        await tx.movimientoInventario.createMany({
          data: consumos.map((mov) => ({
            sucursal_id: sucursalBigInt,
            item_id: mov.item_id,
            lote_id: mov.lote_id,
            tipo: "Entrada" as const,
            motivo: "Ajuste" as const,
            cantidad: mov.cantidad,
            costo_unit: mov.costo_unit,
            referencia: `Reversa Edición Pedido #${pedidoBigInt}`.slice(0, 64),
          })),
        });
      }

      for (const [insumoIdStr, total] of incrementosPorInsumo) {
        await tx.inventarioSucursal.updateMany({
          where: { sucursal_id: sucursalBigInt, item_id: BigInt(insumoIdStr) },
          data: { stock: { increment: total } },
        });
      }

      // 2. DELETE OLD ITEMS
      await tx.pedidoItemExtra.deleteMany({
        where: { pedido_item: { pedido_id: pedidoBigInt } },
      });
      await tx.pedidoItem.deleteMany({
        where: { pedido_id: pedidoBigInt },
      });

      // 3. APPLY NEW STOCK (SIMULATE FEFO AND WRITE)
      const lotesDisponibles = insumoIds.length > 0 ? await tx.stockLoteSucursal.findMany({
        where: { sucursal_id: sucursalBigInt, lote: { item_id: { in: insumoIds } }, cantidad: { gt: 0 } },
        include: { lote: true },
        orderBy: { lote: { fecha_caducidad: 'asc' } },
      }) : [];

      const lotesPorInsumo = new Map<string, { id: bigint; lote_id: bigint; costo_unit: number; restante: number }[]>();
      for (const stockLote of lotesDisponibles) {
        const key = stockLote.lote.item_id.toString();
        const lista = lotesPorInsumo.get(key) ?? [];
        lista.push({
          id: stockLote.id,
          lote_id: stockLote.lote_id,
          costo_unit: Number(stockLote.lote.costo_unit),
          restante: Number(stockLote.cantidad),
        });
        lotesPorInsumo.set(key, lista);
      }

      const costoPorItem: number[] = [];
      const costoTeoricoPorItem: number[] = [];
      const lotDecrements = new Map<string, { id: bigint; lote_id: bigint; item_id: bigint; costo_unit: number; total: number }>();
      const inventarioDecrements = new Map<string, number>();
      
      const successfulItemsIndices: number[] = [];
      const droppedItems: any[] = [];
      let nuevoTotal = 0;

      items.forEach((itemPedido: any, idx: number) => {
        let costoAcumuladoDelItem = 0;
        const costoTeorico = costoTeoricoDesdeRequerimientos(requerimientosPorItem[idx], costoReferenciaPorInsumo);
        
        let itemHasStock = true;
        // Temporary tracking for this specific item's decrements in case we need to rollback
        const tempLotDecrements = new Map<string, number>();
        const tempInventarioDecrements = new Map<string, number>();

        for (const { insumoId, cantidadRequerida } of requerimientosPorItem[idx]) {
          let restante = cantidadRequerida;
          const lotes = lotesPorInsumo.get(insumoId.toString()) ?? [];

          for (const lote of lotes) {
            if (restante <= 0) break;
            if (lote.restante <= 0) continue;

            const aDescontar = Math.min(lote.restante, restante);
            if (aDescontar <= 0) continue;

            lote.restante -= aDescontar;
            restante -= aDescontar;
            
            tempLotDecrements.set(lote.id.toString(), (tempLotDecrements.get(lote.id.toString()) ?? 0) + aDescontar);
            tempInventarioDecrements.set(insumoId.toString(), (tempInventarioDecrements.get(insumoId.toString()) ?? 0) + aDescontar);

            costoAcumuladoDelItem += aDescontar * lote.costo_unit;
          }

          if (restante > 0) {
            itemHasStock = false;
            break;
          }
        }

        if (itemHasStock) {
          // Commit temp decrements to main tracking
          for (const [loteIdStr, qty] of tempLotDecrements) {
             const key = loteIdStr;
             // find lote in lotesPorInsumo
             let foundLote: any = null;
             let foundInsumoId: any = null;
             for (const [insumoKey, loteList] of lotesPorInsumo.entries()) {
               const match = loteList.find(l => l.id.toString() === loteIdStr);
               if (match) {
                 foundLote = match;
                 foundInsumoId = BigInt(insumoKey);
                 break;
               }
             }
             if (foundLote) {
                const acumulado = lotDecrements.get(key) ?? { id: foundLote.id, lote_id: foundLote.lote_id, item_id: foundInsumoId, costo_unit: foundLote.costo_unit, total: 0 };
                acumulado.total += qty;
                lotDecrements.set(key, acumulado);
             }
          }
          for (const [insumoStr, qty] of tempInventarioDecrements) {
             inventarioDecrements.set(insumoStr, (inventarioDecrements.get(insumoStr) ?? 0) + qty);
          }
          
          costoPorItem[idx] = costoAcumuladoDelItem;
          costoTeoricoPorItem[idx] = costoTeorico;
          successfulItemsIndices.push(idx);
          nuevoTotal += subtotalPorItem[idx];
        } else {
          // Rollback lotesPorInsumo for this item
          for (const [loteIdStr, qty] of tempLotDecrements) {
            for (const [insumoKey, loteList] of lotesPorInsumo.entries()) {
               const match = loteList.find(l => l.id.toString() === loteIdStr);
               if (match) {
                 match.restante += qty;
                 break;
               }
             }
          }
          droppedItems.push({ ...itemPedido, index: idx, productName: productoMap.get(String(BigInt(itemPedido.producto_id)))?.nombre });
        }
      });

      if (successfulItemsIndices.length === 0) {
        throw new Error("No hay suficiente stock para preparar ningún item de esta actualización.");
      }

      // 4. UPDATE PEDIDO
      const observacionesUpdate = isCorrection 
        ? `${existingOrder.observaciones}\n[Corrección por edición - ${new Date().toLocaleString()}]`
        : existingOrder.observaciones;

      const pedidoActualizado = await tx.pedido.update({
        where: { id: pedidoBigInt },
        data: {
          mesa: mesa,
          cliente_nombre: cliente,
          estado: newState,
          total: nuevoTotal,
          observaciones: observacionesUpdate
        }
      });

      // 5. INSERT NEW ITEMS
      for (const idx of successfulItemsIndices) {
        const itemPedido = items[idx];
        await tx.pedidoItem.create({
          data: {
            pedido_id: pedidoBigInt,
            producto_id: BigInt(itemPedido.producto_id),
            cantidad: Number(itemPedido.cantidad),
            precio_unit: precioUnitPorItem[idx],
            subtotal: subtotalPorItem[idx],
            notas: itemPedido.notas,
            costo_real: costoPorItem[idx],
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

      // 6. DEDUCT STOCK IN DB
      for (const { id, total } of lotDecrements.values()) {
        const res = await tx.stockLoteSucursal.updateMany({
          where: { id, cantidad: { gte: total } },
          data: { cantidad: { decrement: total } },
        });
        if (res.count === 0) {
          throw new Error("Stock insuficiente: otro pedido consumió el inventario simultáneamente, intenta de nuevo");
        }
      }

      if (lotDecrements.size > 0) {
        await tx.movimientoInventario.createMany({
          data: [...lotDecrements.values()].map((lote) => ({
            sucursal_id: sucursalBigInt,
            item_id: lote.item_id,
            lote_id: lote.lote_id,
            tipo: 'Salida' as const,
            motivo: 'Venta' as const,
            cantidad: lote.total,
            costo_unit: lote.costo_unit,
            referencia: `Pedido #${pedidoBigInt}`,
          })),
        });
      }

      for (const [insumoIdStr, total] of inventarioDecrements) {
        await tx.inventarioSucursal.updateMany({
          where: { sucursal_id: sucursalBigInt, item_id: BigInt(insumoIdStr) },
          data: { stock: { decrement: total } },
        });
      }

      return { pedidoId: pedidoActualizado.id.toString(), total: nuevoTotal, droppedItems };
    }, { timeout: 20000 });

    return NextResponse.json({
      success: true,
      pedidoId: resultado.pedidoId,
      total: resultado.total,
      droppedItems: resultado.droppedItems,
      isCorrection,
      message: 'Pedido actualizado'
    });

  } catch (error: any) {
    if (typeof error?.message === "string" && (error.message.startsWith("Stock insuficiente") || error.message.startsWith("No hay suficiente stock"))) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Error al actualizar el pedido");
  }
}

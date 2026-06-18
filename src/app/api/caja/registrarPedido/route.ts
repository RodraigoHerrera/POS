import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { errorResponse } from '@/lib/apiError';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    // 1. Obtener Datos del Body
    const body = await req.json();
    const { items, mesa = "Mostrador", cliente = "Cliente General" } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
    }

    // 2. Validar Sesión
    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
    const tokenEmpleado = cookieStore.get("tokenEmpleado")?.value;

    if (!tokenSucursal || !tokenEmpleado) {
      return NextResponse.json({ error: 'Sesión no válida o expirada' }, { status: 401 });
    }

    // Decodificar Tokens
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

    // 3. Calcular Totales
    const totalPedido = items.reduce((acc: number, item: any) => {
      return acc + (parseFloat(item.precio_unit) * item.cantidad);
    }, 0);

    // 4. PRE-CÁLCULO (fuera de la transacción): resolver productos -> recetas
    //    y simular el consumo FEFO en memoria, para minimizar las consultas
    //    que se hacen mientras la transacción mantiene locks abiertos.
    const productoIds: bigint[] = [...new Set<bigint>(items.map((i: any) => BigInt(i.producto_id)))];

    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, item_inventario_id: true },
    });
    const productoMap = new Map(
      productos.map((p) => [p.id.toString(), p.item_inventario_id])
    );

    const itemInventarioIds = [
      ...new Set(
        productos
          .map((p) => p.item_inventario_id)
          .filter((id): id is bigint => id !== null)
      ),
    ];

    const recetas = await prisma.receta.findMany({
      where: { item_vendible_id: { in: itemInventarioIds } },
      include: { items: true },
    });
    const recetaMap = new Map(recetas.map((r) => [r.item_vendible_id.toString(), r.items]));

    // Requerimientos de insumos por cada item del carrito
    interface Requerimiento { insumoId: bigint; cantidadRequerida: number }

    const requerimientosPorItem: Requerimiento[][] = items.map((itemPedido: any) => {
      const itemInventarioId = productoMap.get(String(BigInt(itemPedido.producto_id)));
      const recetaItems = itemInventarioId ? recetaMap.get(itemInventarioId.toString()) : undefined;

      if (!recetaItems || recetaItems.length === 0) return [];

      return recetaItems.map((ingrediente) => ({
        insumoId: ingrediente.item_insumo_id,
        cantidadRequerida: Number(ingrediente.cantidad) * Number(itemPedido.cantidad),
      }));
    });

    const insumoIds: bigint[] = [
      ...new Set<bigint>(
        requerimientosPorItem.flat().map((r) => r.insumoId)
      ),
    ];

    // Lotes disponibles (FEFO) para todos los insumos involucrados, en una sola consulta
    const lotesDisponibles = insumoIds.length > 0
      ? await prisma.stockLoteSucursal.findMany({
          where: {
            sucursal_id: sucursalBigInt,
            lote: { item_id: { in: insumoIds } },
            cantidad: { gt: 0 },
          },
          include: { lote: true },
          orderBy: { lote: { fecha_caducidad: 'asc' } },
        })
      : [];

    // Agrupar lotes por insumo, conservando el orden FEFO
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

    // Simular el consumo FEFO: acumular costo por item, decremento por lote
    // y decremento total por insumo, todo en memoria.
    const costoPorItem: number[] = [];
    const lotDecrements = new Map<string, { id: bigint; lote_id: bigint; item_id: bigint; costo_unit: number; total: number }>();
    const inventarioDecrements = new Map<string, number>();

    items.forEach((itemPedido: any, idx: number) => {
      let costoAcumuladoDelItem = 0;

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

          const key = lote.id.toString();
          const acumulado = lotDecrements.get(key) ?? { id: lote.id, lote_id: lote.lote_id, item_id: insumoId, costo_unit: lote.costo_unit, total: 0 };
          acumulado.total += aDescontar;
          lotDecrements.set(key, acumulado);

          const insumoKey = insumoId.toString();
          inventarioDecrements.set(insumoKey, (inventarioDecrements.get(insumoKey) ?? 0) + aDescontar);

          costoAcumuladoDelItem += aDescontar * lote.costo_unit;
        }
      }

      costoPorItem.push(costoAcumuladoDelItem);
    });

    // 5. Transacción de Base de Datos
    const nuevoPedido = await prisma.$transaction(async (tx) => {

      // A. Crear Cabecera del Pedido
      const pedido = await tx.pedido.create({
        data: {
          sucursal_id: sucursalBigInt,
          empleado_id: BigInt(empleadoId),
          mesa: mesa,
          cliente_nombre: cliente,
          estado: 'COMANDADO',
          total: totalPedido,
          observaciones: "Pedido desde POS Web",
        },
      });

      // B. Crear el detalle de cada item (con su costo real ya calculado)
      for (let idx = 0; idx < items.length; idx++) {
        const itemPedido = items[idx];

        await tx.pedidoItem.create({
          data: {
            pedido_id: pedido.id,
            producto_id: BigInt(itemPedido.producto_id),
            cantidad: itemPedido.cantidad,
            precio_unit: itemPedido.precio_unit,
            subtotal: itemPedido.precio_unit * itemPedido.cantidad,
            notas: itemPedido.notas,
            costo_real: costoPorItem[idx],
            extras: {
              create: itemPedido.extras.map((extraNombre: string) => ({
                nombre: extraNombre,
                precio: 0,
              })),
            },
          },
        });
      }

      // C. Aplicar los descuentos de inventario acumulados (1 update por lote tocado)
      for (const { id, total } of lotDecrements.values()) {
        await tx.stockLoteSucursal.update({
          where: { id },
          data: { cantidad: { decrement: total } },
        });
      }

      // D. Registrar los movimientos de kardex en una sola operación
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
            referencia: `Pedido #${pedido.id}`,
          })),
        });
      }

      // E. Actualizar el stock agregado por sucursal (1 update por insumo afectado)
      for (const [insumoIdStr, total] of inventarioDecrements) {
        await tx.inventarioSucursal.updateMany({
          where: { sucursal_id: sucursalBigInt, item_id: BigInt(insumoIdStr) },
          data: { stock: { decrement: total } },
        });
      }

      return pedido;
    });

    return NextResponse.json({
      success: true,
      pedidoId: nuevoPedido.id.toString(),
      message: 'Pedido enviado a cocina'
    });

  } catch (error: any) {
    return errorResponse(error, "Error al registrar el pedido");
  }
}
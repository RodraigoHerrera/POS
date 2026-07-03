import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { errorResponse } from '@/lib/apiError';
import { costoTeoricoDesdeRequerimientos, obtenerCostoReferenciaPorInsumo } from '@/lib/costeo';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    // 1. Obtener Datos del Body
    const body = await req.json();
    const { items, mesa = "Mostrador", cliente = "Cliente General" } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
    }

    // Validar cada línea: producto y cantidad entera positiva. El precio NO se
    // toma del body — se resuelve desde la BD más abajo (el cliente solo dice
    // QUÉ compra y CUÁNTO, nunca a qué precio).
    for (const itemPedido of items) {
      const cantidad = Number(itemPedido?.cantidad);
      if (!itemPedido?.producto_id || !Number.isInteger(cantidad) || cantidad <= 0) {
        return NextResponse.json(
          { error: 'Cada item requiere producto_id y una cantidad entera mayor a 0' },
          { status: 400 }
        );
      }
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

    // 3. PRE-CÁLCULO (fuera de la transacción): resolver productos -> recetas.
    //    La lectura de LOTES y la simulación FEFO se hacen DENTRO de la
    //    transacción, porque dependen del stock vigente al momento de escribir.
    const productoIds: bigint[] = [...new Set<bigint>(items.map((i: any) => BigInt(i.producto_id)))];

    const productos = await prisma.producto.findMany({
      where: { id: { in: productoIds } },
      select: { id: true, item_inventario_id: true, precio: true, estado: true, nombre: true },
    });
    const productoMap = new Map(productos.map((p) => [p.id.toString(), p]));

    // Todos los productos deben existir y estar activos (un producto "Inactivo"
    // recién creado desde inventario tiene precio 0: venderlo sería regalarlo).
    for (const itemPedido of items) {
      const producto = productoMap.get(String(BigInt(itemPedido.producto_id)));
      if (!producto) {
        return NextResponse.json(
          { error: `Producto ${itemPedido.producto_id} no existe` },
          { status: 400 }
        );
      }
      if ((producto.estado ?? '').toLowerCase() !== 'activo') {
        return NextResponse.json(
          { error: `El producto "${producto.nombre}" no está disponible para la venta` },
          { status: 409 }
        );
      }
    }

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

    // IDs de modificadorProducto (extras, ej. "+Tocino") referenciados en el
    // carrito, resueltos en una sola consulta junto con el insumo que cada
    // uno consume.
    const extraIds: bigint[] = [
      ...new Set<bigint>(
        items.flatMap((i: any) => (i.extras ?? []).map((e: any) => BigInt(e)))
      ),
    ];
    const modificadores = extraIds.length > 0
      ? await prisma.modificadorProducto.findMany({
          where: { id: { in: extraIds } },
          include: { item_insumo: { select: { id: true, nombre: true } } },
        })
      : [];
    const modificadorMap = new Map(modificadores.map((m) => [m.id.toString(), m]));

    const itemInventarioIdPorItem: (bigint | null)[] = items.map((itemPedido: any) =>
      productoMap.get(String(BigInt(itemPedido.producto_id)))?.item_inventario_id ?? null
    );

    // Solo se aplican extras cuyo modificador pertenece al item vendible de
    // este producto (evita que un ID de extra de otro producto cuele insumos
    // ajenos si el frontend envía un ID obsoleto).
    const extrasValidosPorItem = items.map((itemPedido: any, idx: number) => {
      const itemInventarioId = itemInventarioIdPorItem[idx];
      return (itemPedido.extras ?? [])
        .map((extraId: any) => modificadorMap.get(String(extraId)))
        .filter((m: any) => m && itemInventarioId && m.item_vendible_id.toString() === itemInventarioId.toString());
    });

    // 4. Calcular Totales con el precio de la BD (snapshot del momento):
    // precio base del producto + precio de los extras aplicados, por cantidad.
    const precioUnitPorItem: number[] = items.map((itemPedido: any) =>
      Number(productoMap.get(String(BigInt(itemPedido.producto_id)))!.precio)
    );
    const subtotalPorItem: number[] = items.map((itemPedido: any, idx: number) => {
      const extraPrecioUnitario = extrasValidosPorItem[idx].reduce(
        (acc: number, m: any) => acc + Number(m.precio), 0
      );
      return (precioUnitPorItem[idx] + extraPrecioUnitario) * Number(itemPedido.cantidad);
    });
    const totalPedido = subtotalPorItem.reduce((acc, s) => acc + s, 0);

    // Requerimientos de insumos por cada item del carrito: receta (BOM) + extras
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

    const insumoIds: bigint[] = [
      ...new Set<bigint>(
        requerimientosPorItem.flat().map((r) => r.insumoId)
      ),
    ];

    // Costo teórico: costo_estandar (si está fijado) o costo_promedio como
    // fallback, de cada insumo, independiente del FEFO. Se contrasta contra
    // el costo_real más abajo.
    const costoReferenciaPorInsumo = await obtenerCostoReferenciaPorInsumo(sucursalBigInt, insumoIds);

    // 5. Transacción: leer lotes, simular FEFO, validar stock y escribir todo
    //    de forma atómica. Los decrementos por lote llevan un guard de stock
    //    (cantidad >= descontado): si otro pedido consumió el mismo lote entre
    //    la lectura y la escritura, la transacción falla y se revierte en vez
    //    de dejar stock negativo.
    const nuevoPedido = await prisma.$transaction(async (tx) => {

      // Lotes disponibles (FEFO) para todos los insumos involucrados, en una sola consulta
      const lotesDisponibles = insumoIds.length > 0
        ? await tx.stockLoteSucursal.findMany({
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
      const costoTeoricoPorItem: number[] = [];
      const lotDecrements = new Map<string, { id: bigint; lote_id: bigint; item_id: bigint; costo_unit: number; total: number }>();
      const inventarioDecrements = new Map<string, number>();
      const insumosSinStock = new Set<string>();

      items.forEach((_itemPedido: any, idx: number) => {
        let costoAcumuladoDelItem = 0;
        costoTeoricoPorItem.push(
          costoTeoricoDesdeRequerimientos(requerimientosPorItem[idx], costoReferenciaPorInsumo)
        );

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

          // Si los lotes no cubren el requerimiento, el pedido NO pasa: antes
          // esto se ignoraba en silencio y el inventario quedaba sobreestimado
          // (se vendía insumo que el sistema creía seguir teniendo).
          if (restante > 0) {
            insumosSinStock.add(insumoId.toString());
          }
        }

        costoPorItem.push(costoAcumuladoDelItem);
      });

      if (insumosSinStock.size > 0) {
        const faltantes = await tx.item.findMany({
          where: { id: { in: [...insumosSinStock].map((id) => BigInt(id)) } },
          select: { nombre: true },
        });
        const nombres = faltantes.map((f) => f.nombre).join(", ");
        throw new Error(`Stock insuficiente para preparar el pedido. Insumos faltantes: ${nombres}`);
      }

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

      // C. Aplicar los descuentos de inventario acumulados (1 update por lote
      // tocado), con guard de stock: si el lote ya no tiene lo simulado
      // (otro pedido concurrente lo consumió), count=0 y se revierte todo.
      for (const { id, total } of lotDecrements.values()) {
        const resultado = await tx.stockLoteSucursal.updateMany({
          where: { id, cantidad: { gte: total } },
          data: { cantidad: { decrement: total } },
        });
        if (resultado.count === 0) {
          throw new Error("Stock insuficiente: otro pedido consumió el inventario simultáneamente, intenta de nuevo");
        }
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
    }, { timeout: 15000 });

    return NextResponse.json({
      success: true,
      pedidoId: nuevoPedido.id.toString(),
      total: totalPedido,
      message: 'Pedido enviado a cocina'
    });

  } catch (error: any) {
    if (typeof error?.message === "string" && error.message.startsWith("Stock insuficiente")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Error al registrar el pedido");
  }
}

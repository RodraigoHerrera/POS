import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { errorResponse } from '@/lib/apiError';
import { costoTeoricoDesdeRequerimientos, obtenerCostoReferenciaPorInsumo } from '@/lib/costeo';
import { simularConsumoFEFO, applySortedStockDecrements } from '@/lib/fefo';
import { runWithRetry } from '@/lib/transactionRetry';

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
    const costoTeoricoPorItem: number[] = items.map((_, idx) =>
      costoTeoricoDesdeRequerimientos(requerimientosPorItem[idx], costoReferenciaPorInsumo)
    );

    // 5. Transacción con reintento automático contra Deadlocks (P2034 / 1213 / 1205):
    //    Lectura FEFO, simulación determinística y mutaciones ordenadas por id ASC (INV-1, INV-2).
    const nuevoPedido = await runWithRetry(async (tx) => {
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

      // Simular el consumo FEFO y validar disponibilidad
      const simulation = simularConsumoFEFO(lotesDisponibles, requerimientosPorItem);

      if (simulation.insumosSinStock.length > 0) {
        const faltantes = await tx.item.findMany({
          where: { id: { in: simulation.insumosSinStock } },
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

      // C, D, E. Aplicar descuentos ordenados determinísticamente por ID (INV-1, INV-2)
      await applySortedStockDecrements(
        tx,
        sucursalBigInt,
        simulation.lotDecrements,
        simulation.inventarioDecrements,
        `Pedido #${pedido.id}`
      );

      return pedido;
    }, { timeoutMs: 15000 });

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

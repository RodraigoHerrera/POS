import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/apiError';
import { runWithRetry } from '@/lib/transactionRetry';
import { validateOrderForBilling } from '@/lib/caja';
import { requireEmpleado, esRespuestaError } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      pedidoId, 
      metodoPago, 
      montoPagado, // Solo relevante para efectivo
      facturacion: { nit, razonSocial } = {}, 
      detallesPago 
    } = body;

    // 1. Validar Sesión: misma caja "abierta" que usan /api/caja/resumen y
    // /api/caja/cerrar (derivada de sucursal+empleado), en vez de depender
    // de la cookie tokenCaja — esa solo se setea al momento de abrir la caja
    // y no sobrevive a un re-login con la caja ya abierta.
    const sesion = await requireEmpleado(["Cajero", "Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const { sucursalId, empleadoId } = sesion;

    const cajaAbierta = await prisma.caja.findFirst({
      where: {
        sucursal_id: BigInt(sucursalId),
        empleado_id: BigInt(empleadoId),
        estado: 'abierta',
      },
    });

    if (!cajaAbierta) {
      return NextResponse.json({ error: 'No tienes una caja abierta en esta sucursal' }, { status: 404 });
    }

    const cajaId = cajaAbierta.id;

    // 2. Transacción Protegida con Retry y Bloqueo Pesimista (Cobro + Factura + Reportes)
    const resultado = await runWithRetry(async (tx) => {
      // A. PESSIMISTIC ROW LOCK ACQUISITION (INV-SEC04-3)
      const lockedOrders = await tx.$queryRaw<Array<{ id: bigint; sucursal_id: bigint; estado: string; total: any }>>`
        SELECT id, sucursal_id, estado, total
        FROM \`pedido\`
        WHERE id = ${BigInt(pedidoId)}
        FOR UPDATE
      `;
      const lockedOrder = lockedOrders[0];

      // B. DEEP ORDER READ UNDER LOCK
      // Necesitamos: Producto (para nombre y categoria) -> Item Inventario (para SKU)
      const pedido = await tx.pedido.findUnique({
        where: { id: BigInt(pedidoId) },
        include: { 
          empleado: true, // Necesario para saber quién vendió en el historial
          items: { 
            include: { 
              producto: {
                include: {
                  item_inventario: true // Para obtener el SKU real del inventario
                }
              } 
            } 
          } 
        }
      });

      // Validar invariantes de facturación (INV-SEC04-1, INV-SEC04-2)
      validateOrderForBilling({
        lockedOrder,
        sucursalId,
        items: pedido?.items,
        total: pedido?.total,
        metodoPago,
        recibido: montoPagado !== undefined ? Number(montoPagado) : undefined,
        pedidoDetail: pedido ? { items: pedido.items, total: pedido.total } : null,
        montoPagado,
      });

      if (!pedido) {
        throw new Error("Pedido no encontrado");
      }

      // C. Actualizar Estado del Pedido — con guard atómico (INV-SEC04-1)
      const transicion = await tx.pedido.updateMany({
        where: { id: BigInt(pedidoId), estado: { notIn: ['PAGADO', 'ANULADO'] } },
        data: {
          estado: 'PAGADO',
          caja_id: cajaId,
        }
      });
      if (transicion.count === 0) throw new Error("El pedido ya fue pagado o anulado");

      // D. Registrar Movimiento de Caja (Ingreso de Dinero Físico)
      if (metodoPago === 'cash') {
        await tx.movimientoCaja.create({
          data: {
             caja_id: cajaId,
             tipo: 'INGRESO',
             monto: pedido.total, // Ingresa el total de la venta
             descripcion: `Venta Pedido #${pedidoId} - Efectivo`,
             origen: 'VENTA',
          }
        });
      }

      // E. Generar la FACTURA (Snapshot no vacío garantizado)
      const nuevaFactura = await tx.factura.create({
        data: {
          pedido_id: BigInt(pedidoId),
          razon_social: razonSocial || "S/N",
          nit: nit || "0",
          importe_total: pedido.total,
          metodo_pago: metodoPago,
          // Snapshot del contenido para auditoría fiscal
          detalle_items: JSON.parse(JSON.stringify(pedido.items.map(i => ({
             nombre: i.producto.nombre,
             cantidad: i.cantidad,
             precio_unit: i.precio_unit,
             subtotal: i.subtotal
          })))),
        }
      });

      // F. GENERAR HISTORIAL DE VENTAS (Data Warehouse Operativo)
      for (const item of pedido.items) {
          const costoTotal = Number(item.costo_real || 0); // Costo calculado en FEFO
          const costoTeoricoTotal = Number(item.costo_teorico || 0); // Receta (BOM) x costo_promedio
          const ventaTotal = Number(item.subtotal);
          const cantidad = item.cantidad;
          const costoUnitario = cantidad > 0 ? costoTotal / cantidad : 0;
          const costoTeoricoUnitario = cantidad > 0 ? costoTeoricoTotal / cantidad : 0;
          const precioUnitario = Number(item.precio_unit);

          await tx.historialVentas.create({
              data: {
                  fecha_venta: new Date(),
                  sucursal_id: pedido.sucursal_id,
                  pedido_id: pedido.id,
                  empleado_id: pedido.empleado_id,
                  
                  // Datos del Producto (Snapshot)
                  producto_id: item.producto_id,
                  producto_nombre: item.producto.nombre,
                  sku_producto: item.producto.item_inventario?.sku || "S/N",
                  categoria: item.producto.categoria,

                  // Métricas Financieras
                  cantidad: cantidad,
                  precio_unitario: precioUnitario,
                  venta_total: ventaTotal,
                  
                  // Análisis de Rentabilidad
                  costo_unitario: costoUnitario,
                  costo_total: costoTotal,
                  margen_ganancia: ventaTotal - costoTotal,
                  costo_teorico_unitario: costoTeoricoUnitario,
                  costo_teorico_total: costoTeoricoTotal,

                  // Contexto
                  nombre_cliente: razonSocial || pedido.cliente_nombre, 
                  numero_factura: nuevaFactura.id.toString(),
                  metodo_pago: metodoPago
              }
          });
      }

      return nuevaFactura;
    }, { timeoutMs: 20000 });

    const cambio = metodoPago === 'cash'
      ? Number(montoPagado) - Number(resultado.importe_total)
      : 0;

    return NextResponse.json({
      success: true,
      facturaId: resultado.id.toString(),
      cambio,
      mensaje: "Venta cerrada, facturada y registrada en historial correctamente"
    });

  } catch (error: any) {
    if (error.message === "Pedido no encontrado" || error.message === "PEDIDO_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (
      error.message === "El pedido ya fue pagado" ||
      error.message === "El pedido está anulado" ||
      error.message === "El pedido ya fue pagado o anulado" ||
      error.message === "PEDIDO_ALREADY_CLOSED" ||
      error.code === 'P2002'
    ) {
      return NextResponse.json({ 
        error: error.message === "El pedido está anulado" ? "El pedido está anulado" : "El pedido ya fue pagado" 
      }, { status: 409 });
    }
    if (error.message === "Monto pagado insuficiente") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error.message === "El pedido no contiene items para facturar." ||
      error.message === "NO_ITEMS_TO_INVOICE"
    ) {
      return NextResponse.json({ error: "El pedido no contiene items para facturar." }, { status: 400 });
    }
    if (
      error.message === "El total del pedido debe ser mayor a 0" ||
      error.message === "INVALID_ORDER_TOTAL"
    ) {
      return NextResponse.json({ error: "El total del pedido debe ser mayor a 0" }, { status: 400 });
    }
    return errorResponse(error, "Error al procesar el cobro");
  }
}

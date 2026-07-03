import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db'; // Asegúrate de usar la ruta correcta a tu instancia de prisma
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { errorResponse } from '@/lib/apiError';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      pedidoId, 
      metodoPago, 
      montoPagado, // Solo relevante para efectivo
      facturacion: { nit, razonSocial }, 
      detallesPago 
    } = body;

    // 1. Validar Sesión: misma caja "abierta" que usan /api/caja/resumen y
    // /api/caja/cerrar (derivada de sucursal+empleado), en vez de depender
    // de la cookie tokenCaja — esa solo se setea al momento de abrir la caja
    // y no sobrevive a un re-login con la caja ya abierta.
    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
    const tokenEmpleado = cookieStore.get("tokenEmpleado")?.value;

    if (!tokenSucursal || !tokenEmpleado) {
      return NextResponse.json({ error: 'Sesión no válida o expirada' }, { status: 401 });
    }

    let sucursalId: string;
    let empleadoId: string;
    try {
      const payloadSucursal = await jwtVerify(tokenSucursal, secret);
      sucursalId = (payloadSucursal.payload as any)?.sucursalId || (payloadSucursal.payload as any)?.id;

      const payloadEmpleado = await jwtVerify(tokenEmpleado, secret);
      empleadoId = (payloadEmpleado.payload as any)?.empleadoId || (payloadEmpleado.payload as any)?.id;
    } catch (e) {
      return NextResponse.json({ error: 'Error verificando tokens' }, { status: 403 });
    }

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

    // 2. Transacción Gigante (Cobro + Factura + Reportes)
    const resultado = await prisma.$transaction(async (tx) => {
      
      // A. Obtener el pedido actual CON datos profundos para el reporte
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

      if (!pedido) throw new Error("Pedido no encontrado");
      // El pedido debe ser de la MISMA sucursal que cobra: sin este check un
      // cajero de otra sucursal podía facturarlo, y el ingreso caía en su caja
      // mientras historialVentas lo registraba en la sucursal original.
      if (pedido.sucursal_id.toString() !== String(sucursalId)) {
        throw new Error("Pedido no encontrado");
      }
      if (pedido.estado === 'PAGADO') throw new Error("El pedido ya fue pagado");
      if (pedido.estado === 'ANULADO') throw new Error("El pedido está anulado");

      // En efectivo, lo recibido debe cubrir el total (el cambio se calcula
      // sobre esto mismo y se devuelve al frontend).
      if (metodoPago === 'cash') {
        const recibido = Number(montoPagado);
        if (!Number.isFinite(recibido) || recibido < Number(pedido.total)) {
          throw new Error("Monto pagado insuficiente");
        }
      }

      // B. Actualizar Estado del Pedido — con guard atómico: si una anulación
      // concurrente ganó entre la lectura de arriba y este update, count=0 y
      // el cobro se revierte completo (no se factura un pedido anulado).
      const transicion = await tx.pedido.updateMany({
        where: { id: BigInt(pedidoId), estado: { notIn: ['PAGADO', 'ANULADO'] } },
        data: {
          estado: 'PAGADO',
          caja_id: cajaId,
          // Podrías guardar el método de pago aquí también si agregas el campo al modelo pedido
        }
      });
      if (transicion.count === 0) throw new Error("El pedido ya fue pagado o anulado");

      // C. Registrar Movimiento de Caja (Ingreso de Dinero Físico)
      if (metodoPago === 'cash') {
        await tx.movimientoCaja.create({
          data: {
             caja_id: cajaId,
             tipo: 'INGRESO',
             monto: pedido.total, // Ingresa el total de la venta
             descripcion: `Venta Pedido #${pedidoId} - Efectivo`,
          }
        });
      }

      // D. Generar la FACTURA
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

      // E. GENERAR HISTORIAL DE VENTAS (Data Warehouse Operativo)
      // Esto alimenta tus gráficos y reportes sin tener que hacer joins complejos después
      for (const item of pedido.items) {
          
          const costoTotal = Number(item.costo_real || 0); // Costo calculado en FEFO (route anterior)
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
                  // Intentamos sacar el SKU del inventario, si no existe ponemos S/N
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
    });

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
    if (error.message === "Pedido no encontrado") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (
      error.message === "El pedido ya fue pagado" ||
      error.message === "El pedido está anulado" ||
      error.message === "El pedido ya fue pagado o anulado"
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message === "Monto pagado insuficiente") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Carrera de doble cobro: factura.pedido_id es @unique, el segundo insert
    // concurrente cae aquí con P2002 en vez de duplicar la factura.
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "El pedido ya fue pagado" }, { status: 409 });
    }
    return errorResponse(error, "Error al procesar el cobro");
  }
}
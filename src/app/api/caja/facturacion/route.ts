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

    // 1. Validar Sesión de Caja
    const cookieStore = await cookies();
    const tokenCaja = cookieStore.get("tokenCaja")?.value;

    if (!tokenCaja) {
      return NextResponse.json({ error: 'Sesión no válida o expirada' }, { status: 401 });
    }

    // Decodificar Token
    let cajaId;
    try {
      const payloadCaja = await jwtVerify(tokenCaja, secret);
      cajaId = (payloadCaja.payload as any)?.cajaId || (payloadCaja.payload as any)?.id;
    } catch (e) {
      return NextResponse.json({ error: 'Error verificando tokens' }, { status: 403 });
    }

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
      if (pedido.estado === 'PAGADO') throw new Error("El pedido ya fue pagado");

      // B. Actualizar Estado del Pedido
      await tx.pedido.update({
        where: { id: BigInt(pedidoId) },
        data: {
          estado: 'PAGADO',
          caja_id: BigInt(cajaId),
          // Podrías guardar el método de pago aquí también si agregas el campo al modelo pedido
        }
      });

      // C. Registrar Movimiento de Caja (Ingreso de Dinero Físico)
      if (metodoPago === 'cash') {
        await tx.movimientoCaja.create({
          data: {
             caja_id: BigInt(cajaId),
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
          const ventaTotal = Number(item.subtotal);
          const cantidad = item.cantidad;
          const costoUnitario = cantidad > 0 ? costoTotal / cantidad : 0;
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

                  // Contexto
                  nombre_cliente: razonSocial || pedido.cliente_nombre, 
                  numero_factura: nuevaFactura.id.toString(),
                  metodo_pago: metodoPago
              }
          });
      }

      return nuevaFactura;
    });

    return NextResponse.json({ 
      success: true, 
      facturaId: resultado.id.toString(),
      mensaje: "Venta cerrada, facturada y registrada en historial correctamente"
    });

  } catch (error: any) {
    if (error.message === "Pedido no encontrado") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message === "El pedido ya fue pagado") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Error al procesar el cobro");
  }
}
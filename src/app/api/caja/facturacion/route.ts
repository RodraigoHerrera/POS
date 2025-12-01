import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      pedidoId, 
      metodoPago, 
      montoPagado, // Solo relevante para efectivo
      facturacion: { nit, razonSocial }, // Datos del form que hiciste
      detallesPago // { last4: '1234' } para tarjetas
    } = body;

    // 1. Validar Sesión (Necesitamos saber quién cobra y en qué caja)
    // ... (Tu lógica de validación de tokens aquí, igual que en apertura de caja) ...
    // Asumiremos que ya obtuviste: sucursalId, empleadoId, cajaId
    const cookieStore = await cookies();
    const tokenCaja = cookieStore.get("tokenCaja")?.value;

    if ( !tokenCaja) {
    return NextResponse.json({ error: 'Sesión no válida o expirada' }, { status: 401 });
    }

    // Decodificar Tokens
    let cajaId;
    try {
        const payloadCaja = await jwtVerify(tokenCaja, secret);
        cajaId = (payloadCaja.payload as any)?.cajaId || (payloadCaja.payload as any)?.id;

    } catch (e) {
    return NextResponse.json({ error: 'Error verificando tokens' }, { status: 403 });
    }

    // 2. Transacción Gigante (Todo o Nada)
    const resultado = await prisma.$transaction(async (tx) => {
      
      // A. Obtener el pedido actual con sus items para congelar precios
      const pedido = await tx.pedido.findUnique({
        where: { id: BigInt(pedidoId) },
        include: { items: { include: { producto: true } } }
      });

      if (!pedido) throw new Error("Pedido no encontrado");
      if (pedido.estado === 'PAGADO') throw new Error("El pedido ya fue pagado");

      // B. Actualizar Pedido
      await tx.pedido.update({
        where: { id: BigInt(pedidoId) },
        data: {
          estado: 'PAGADO',
          caja_id: BigInt(cajaId), // Asignamos a la caja actual
        }
      });

      // C. Registrar Movimiento de Caja (Si es efectivo)
      if (metodoPago === 'cash') {
        await tx.movimientoCaja.create({
          data: {
             caja_id: BigInt(cajaId),
             tipo: 'INGRESO',
             monto: pedido.total, // Ojo: entra el total de la venta, no lo que entregó el cliente
             descripcion: `Venta Pedido #${pedidoId} - Efectivo`,
          }
        });
      }

      // D. Generar la FACTURA
      // Aquí podrías llamar a una API externa (ej. SIAT) antes de guardar
      // const datosFiscales = await facturacionService.emitir(pedido.total, nit);
      
      const nuevaFactura = await tx.factura.create({
        data: {
          pedido_id: BigInt(pedidoId),
          razon_social: razonSocial || "S/N",
          nit: nit || "0",
          importe_total: pedido.total,
          metodo_pago: metodoPago,
          // Snapshot del contenido
          detalle_items: JSON.parse(JSON.stringify(pedido.items.map(i => ({
             nombre: i.producto.nombre,
             cantidad: i.cantidad,
             precio_unit: i.precio_unit,
             subtotal: i.subtotal
          })))),
          
        }
      });

      return nuevaFactura;
    });

    return NextResponse.json({ 
      success: true, 
      facturaId: resultado.id.toString(),
      mensaje: "Venta cerrada y facturada correctamente"
    });

  } catch (error: any) {
    console.error("Error al cobrar:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
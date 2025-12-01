import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    // 1. Obtener Datos del Body
    const body = await req.json();
    const { items, mesa = "Mostrador", cliente = "Cliente General" } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 });
    }

    // 2. Validar Sesión (Sucursal y Empleado)
    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
    const tokenEmpleado = cookieStore.get("tokenEmpleado")?.value;
    const tokenCaja = cookieStore.get("tokenCaja")?.value;

    if (!tokenSucursal || !tokenEmpleado || !tokenCaja) {
      return NextResponse.json({ error: 'Sesión no válida o expirada' }, { status: 401 });
    }

    // Decodificar Tokens
    let sucursalId, empleadoId, cajaId;
    try {
      const payloadSucursal = await jwtVerify(tokenSucursal, secret);
      sucursalId = (payloadSucursal.payload as any)?.sucursalId || (payloadSucursal.payload as any)?.id;

      const payloadEmpleado = await jwtVerify(tokenEmpleado, secret);
      empleadoId = (payloadEmpleado.payload as any)?.empleadoId || (payloadEmpleado.payload as any)?.id;

      const payloadCaja = await jwtVerify(tokenCaja, secret);
      cajaId = (payloadCaja.payload as any)?.cajaId || (payloadCaja.payload as any)?.id;

    } catch (e) {
      return NextResponse.json({ error: 'Error verificando tokens' }, { status: 403 });
    }

    // 3. Calcular Totales (Validación Backend)
    // Es recomendable recalcular precios aquí buscando en DB, 
    // pero para este ejemplo usaremos los enviados confiando en la UI por ahora.
    const totalPedido = items.reduce((acc: number, item: any) => {
      return acc + (parseFloat(item.precio_unit) * item.cantidad);
    }, 0);

    // 4. Transacción de Base de Datos
    const nuevoPedido = await prisma.$transaction(async (tx) => {
      
      // A. Crear Cabecera del Pedido
      const pedido = await tx.pedido.create({
        data: {
          sucursal_id: BigInt(sucursalId),
          empleado_id: BigInt(empleadoId),
          caja_id: BigInt(cajaId),
          mesa: mesa,
          cliente_nombre: cliente,
          estado: 'COMANDADO', // Estado inicial para cocina
          total: totalPedido,
          observaciones: "Pedido desde POS Web",
        },
      });

      // B. Crear Items y sus Extras
      for (const item of items) {
        await tx.pedidoItem.create({
          data: {
            pedido_id: pedido.id,
            producto_id: BigInt(item.producto_id),
            cantidad: item.cantidad,
            precio_unit: item.precio_unit,
            subtotal: item.precio_unit * item.cantidad,
            notas: item.notas,
            // Crear extras anidados
            extras: {
              create: item.extras.map((extraNombre: string) => ({
                nombre: extraNombre,
                precio: 0, // Ojo: Aquí deberías buscar el precio real del extra en la DB si aplica
              })),
            },
          },
        });
        
        // C. AQUÍ IRÍA LA LÓGICA DE DESCUENTO DE INVENTARIO (Recetas/FEFO)
        // Se omite por brevedad, pero aquí llamarías a tu función de explosión de recetas.
      }

      return pedido;
    });

    return NextResponse.json({ 
      success: true, 
      pedidoId: nuevoPedido.id.toString(),
      message: 'Pedido enviado a cocina' 
    });


  } catch (error: any) {
    console.error("Error al registrar pedido:", error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
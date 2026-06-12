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

    // 4. Transacción de Base de Datos
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

      // B. Procesar Items del Pedido
      for (const itemPedido of items) {
        
        // B.1 Crear detalle en tabla pedidoItem y GUARDAR REFERENCIA
        const nuevoPedidoItem = await tx.pedidoItem.create({
          data: {
            pedido_id: pedido.id,
            producto_id: BigInt(itemPedido.producto_id),
            cantidad: itemPedido.cantidad,
            precio_unit: itemPedido.precio_unit,
            subtotal: itemPedido.precio_unit * itemPedido.cantidad,
            notas: itemPedido.notas,
            costo_real: 0, // Inicializamos en 0, lo calcularemos abajo
            extras: {
              create: itemPedido.extras.map((extraNombre: string) => ({
                nombre: extraNombre,
                precio: 0, 
              })),
            },
          },
        });

        // Variable para acumular el costo financiero de este item (Suma de costos de insumos)
        let costoAcumuladoDelItem = 0;
        
        // C. LÓGICA DE DESCUENTO DE INVENTARIO Y CALCULO DE COSTOS
        
        // 1. Obtener el Producto para ver a qué ITEM de inventario está vinculado
        const productoDB = await tx.producto.findUnique({
          where: { id: BigInt(itemPedido.producto_id) },
          select: { item_inventario_id: true } 
        });

        if (productoDB && productoDB.item_inventario_id) {
          
          // 2. Buscar la receta asociada a ese Item
          const receta = await tx.receta.findUnique({
            where: { item_vendible_id: productoDB.item_inventario_id },
            include: { items: true }
          });

          if (receta && receta.items.length > 0) {
            
            // 3. Iterar sobre cada ingrediente de la receta
            for (const ingrediente of receta.items) {
              
              let cantidadRequerida = Number(ingrediente.cantidad) * Number(itemPedido.cantidad);
              const insumoId = ingrediente.item_insumo_id;

              // 4. Buscar lotes disponibles (FEFO)
              const lotesDisponibles = await tx.stockLoteSucursal.findMany({
                where: {
                  sucursal_id: sucursalBigInt,
                  lote: { item_id: insumoId },
                  cantidad: { gt: 0 }
                },
                include: { lote: true },
                orderBy: { lote: { fecha_caducidad: 'asc' } }
              });

              // 5. Descontar de los lotes
              for (const stockLote of lotesDisponibles) {
                if (cantidadRequerida <= 0) break; 

                const disponibleEnLote = Number(stockLote.cantidad);
                const aDescontar = Math.min(disponibleEnLote, cantidadRequerida);

                if (aDescontar > 0) {
                  // --- ACTUALIZACIÓN FÍSICA ---
                  
                  // Actualizar Stock Lote
                  await tx.stockLoteSucursal.update({
                    where: { id: stockLote.id },
                    data: { cantidad: { decrement: aDescontar } }
                  });

                  // Registrar Movimiento
                  await tx.movimientoInventario.create({
                    data: {
                      sucursal_id: sucursalBigInt,
                      item_id: insumoId,
                      lote_id: stockLote.lote_id,
                      tipo: 'Salida', 
                      motivo: 'Venta', 
                      cantidad: aDescontar,
                      costo_unit: stockLote.lote.costo_unit,
                      referencia: `Pedido #${pedido.id}`,
                    }
                  });

                  // Actualizar Inventario Global
                  await tx.inventarioSucursal.updateMany({
                    where: { sucursal_id: sucursalBigInt, item_id: insumoId },
                    data: { stock: { decrement: aDescontar } }
                  });

                  // --- CÁLCULO FINANCIERO (NUEVO) ---
                  // Sumamos al costo del item: Cantidad * Costo Unitario de ESTE lote específico
                  const costoDeEstaDeduccion = aDescontar * Number(stockLote.lote.costo_unit);
                  costoAcumuladoDelItem += costoDeEstaDeduccion;

                  cantidadRequerida -= aDescontar;
                }
              }
            }
          }
        }

        // D. FINALIZAR ITEM: Guardar el costo real calculado
        if (costoAcumuladoDelItem > 0) {
          await tx.pedidoItem.update({
            where: { id: nuevoPedidoItem.id },
            data: { costo_real: costoAcumuladoDelItem }
          });
        }
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
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/apiError';
import { requireEmpleado, esRespuestaError } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    // 1. Autenticación y rol (dashboard gerencial)
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;

    // 2. Calcular Rango de Fechas (Mes Actual)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0 = Enero, 11 = Diciembre

    // Primer día del mes actual a las 00:00:00
    const startOfMonth = new Date(year, month, 1);
    
    // Último día del mes actual a las 23:59:59
    // (El día 0 del siguiente mes es el último día del mes actual)
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // 3. Consulta Agregada (SUM)
    const resultado = await prisma.historialVentas.aggregate({
      _sum: {
        venta_total: true, // Sumamos el dinero
      },
      where: {
        sucursal_id: BigInt(sucursalId),
        fecha_venta: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // 3b. Conteo de pedidos distintos en el mismo rango
    const pedidosDistintos = await prisma.historialVentas.groupBy({
      by: ['pedido_id'],
      where: {
        sucursal_id: BigInt(sucursalId),
        fecha_venta: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // 4. Formatear Resultado
    // Si no hay ventas, Prisma devuelve null, así que usamos el operador ?? 0
    const totalMesActual = Number(resultado._sum.venta_total ?? 0);
    const pedidosCount = pedidosDistintos.length;

    return NextResponse.json({
      success: true,
      mes: month + 1, // Retornamos el número de mes para referencia (1-12)
      anio: year,
      total: totalMesActual, // El monto total en Bolivianos
      formatted: `Bs ${totalMesActual.toFixed(2)}`, // Formato listo para mostrar
      pedidosCount, // Cantidad de pedidos distintos del mes
      pedidosFormatted: `${pedidosCount} pedidos`,
    });

  } catch (error: any) {
    return errorResponse(error, "Error al obtener el total del mes");
  }
}
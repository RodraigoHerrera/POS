import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/apiError';
import { requireEmpleado, esRespuestaError } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    // 1. Autenticación y rol (datos de costo/margen — dashboard gerencial)
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;

    // 2. Calcular Rangos de Fechas (Mes Actual y Mes Anterior)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0 = Enero, 11 = Diciembre

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const startOfPrevMonth = new Date(year, month - 1, 1);
    const endOfPrevMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // 3. Consultas Agregadas (SUM) — mes actual y mes anterior
    const [actual, anterior] = await Promise.all([
      prisma.historialVentas.aggregate({
        _sum: { venta_total: true, costo_total: true, margen_ganancia: true },
        where: {
          sucursal_id: BigInt(sucursalId),
          fecha_venta: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.historialVentas.aggregate({
        _sum: { venta_total: true, costo_total: true },
        where: {
          sucursal_id: BigInt(sucursalId),
          fecha_venta: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
      }),
    ]);

    // 4. Formatear Resultado
    const ventaTotal = Number(actual._sum.venta_total ?? 0);
    const costoTotal = Number(actual._sum.costo_total ?? 0);
    const margen = Number(actual._sum.margen_ganancia ?? 0);
    const costoPct = ventaTotal > 0 ? (costoTotal / ventaTotal) * 100 : 0;

    const ventaAnterior = Number(anterior._sum.venta_total ?? 0);
    const costoAnterior = Number(anterior._sum.costo_total ?? 0);
    const costoPctMesAnterior = ventaAnterior > 0 ? (costoAnterior / ventaAnterior) * 100 : 0;

    return NextResponse.json({
      success: true,
      mes: month + 1,
      anio: year,
      ventaTotal,
      costoTotal,
      margen,
      costoPct,
      costoPctMesAnterior,
    });

  } catch (error: any) {
    return errorResponse(error, "Error al obtener el costo de producción");
  }
}

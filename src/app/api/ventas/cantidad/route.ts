import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { errorResponse } from '@/lib/apiError';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function GET(req: Request) {
  try {
    // 1. Autenticación (Verificar sesión de Sucursal)
    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;

    if (!tokenSucursal) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Decodificar Token para obtener el ID de la sucursal
    let sucursalId;
    try {
      const payload = await jwtVerify(tokenSucursal, secret);
      sucursalId = (payload.payload as any)?.sucursalId || (payload.payload as any)?.id;
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 403 });
    }

    // 2. Definir el Rango de Tiempo (Año Actual)
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1); // 1 de Enero 00:00:00
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59); // 31 de Diciembre 23:59:59

    // 3. Consultar la tabla de Historial con la agregación hecha en la DB
    // (evita traer todas las filas del año para sumarlas en memoria)
    const ventasPorMes = await prisma.$queryRaw<{ mes: bigint | number; total: bigint | number | null }[]>`
      SELECT MONTH(fecha_venta) as mes, SUM(cantidad) as total
      FROM historialVentas
      WHERE sucursal_id = ${BigInt(sucursalId)}
        AND fecha_venta BETWEEN ${startOfYear} AND ${endOfYear}
      GROUP BY MONTH(fecha_venta)
    `;

    // 4. Mapear los resultados agregados a un arreglo de 12 posiciones
    const cantidadesPorMes = Array(12).fill(0);

    ventasPorMes.forEach((fila) => {
      cantidadesPorMes[Number(fila.mes) - 1] = Number(fila.total ?? 0);
    });

    // 5. Formatear respuesta para el Frontend
    const labels = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];

    return NextResponse.json({
      success: true,
      year: currentYear,
      labels: labels,
      data: cantidadesPorMes, // Array con las cantidades mensuales
      totalAnual: cantidadesPorMes.reduce((a, b) => a + b, 0)
    });

  } catch (error: any) {
    return errorResponse(error, "Error al generar el reporte mensual");
  }
}
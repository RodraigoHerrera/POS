import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

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

    // 3. Consultar la tabla de Historial
    // CAMBIO: Ahora seleccionamos 'cantidad' en lugar de 'venta_total'
    const ventas = await prisma.historialVentas.findMany({
      where: {
        sucursal_id: BigInt(sucursalId),
        fecha_venta: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      select: {
        fecha_venta: true,
        cantidad: true // Solicitamos la cantidad de items vendidos
      }
    });

    // 4. Procesamiento de Datos (Agregación en Memoria)
    const cantidadesPorMes = Array(12).fill(0);

    ventas.forEach((venta) => {
      const mesIndex = new Date(venta.fecha_venta).getMonth();
      
      // Sumamos la cantidad física
      const cantidad = Number(venta.cantidad);
      
      cantidadesPorMes[mesIndex] += cantidad;
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
    console.error("Error generando reporte mensual:", error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
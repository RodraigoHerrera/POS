import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/apiError';
import { requireEmpleado, esRespuestaError } from '@/lib/auth';

export interface MonthlySalesBucket {
  year: number;
  month: number;
  label: string;
  shortLabel: string;
  quantity: number;
  isCurrentMonth: boolean;
}

export interface VentasCantidadResponse {
  success: boolean;
  window: {
    startDate: string;
    endDate: string;
    totalMonths: number;
  };
  year: number;
  labels: string[];
  data: number[];
  months: MonthlySalesBucket[];
  totalRolling: number;
  totalAnual: number;
}

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

export async function GET() {
  try {
    // 1. Autenticación y rol (datos de dashboard gerencial)
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;

    // 2. Definir el Rango de Tiempo Rodante (12 Meses: M-11 hasta M)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed (0 = Ene, 11 = Dic)

    // Inicio: 1er día del mes M-11 a las 00:00:00.000
    const startDate = new Date(currentYear, currentMonth - 11, 1, 0, 0, 0, 0);

    // Fin: Último milisegundo del mes actual M a las 23:59:59.999
    const endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    // 3. Consultar la tabla de Historial agrupando por AÑO y MES para evitar colisiones
    const ventasPorMes = await prisma.$queryRaw<{ anio: bigint | number; mes: bigint | number; total: bigint | number | null }[]>`
      SELECT 
        YEAR(fecha_venta) AS anio,
        MONTH(fecha_venta) AS mes,
        SUM(cantidad) AS total
      FROM historialVentas
      WHERE sucursal_id = ${BigInt(sucursalId)}
        AND fecha_venta >= ${startDate}
        AND fecha_venta <= ${endDate}
      GROUP BY YEAR(fecha_venta), MONTH(fecha_venta)
      ORDER BY anio ASC, mes ASC
    `;

    // 4. Construir los 12 buckets cronológicos desde M-11 hasta M
    const buckets: MonthlySalesBucket[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1; // 1-indexed (1 = Ene, 12 = Dic)
      const shortYr = String(yr).slice(-2);
      const monthLabel = MONTH_NAMES[mo - 1];

      buckets.push({
        year: yr,
        month: mo,
        label: `${monthLabel} ${shortYr}`, // e.g. "Nov 25", "Ene 26"
        shortLabel: monthLabel,
        quantity: 0,
        isCurrentMonth: i === 0,
      });
    }

    // 5. Mapear resultados agregados de la DB en los buckets (por clave "año-mes")
    const salesMap = new Map<string, number>();
    for (const fila of ventasPorMes) {
      const anio = Number(fila.anio);
      const mes = Number(fila.mes);
      const total = Number(fila.total ?? 0);
      salesMap.set(`${anio}-${mes}`, total);
    }

    for (const bucket of buckets) {
      const key = `${bucket.year}-${bucket.month}`;
      bucket.quantity = salesMap.get(key) ?? 0;
    }

    const labels = buckets.map((b) => b.label);
    const data = buckets.map((b) => b.quantity);
    const totalRolling = data.reduce((a, b) => a + b, 0);

    // 6. Retornar payload tipado y compatible con frontend
    return NextResponse.json<VentasCantidadResponse>({
      success: true,
      window: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalMonths: 12,
      },
      year: currentYear,
      labels,
      data,
      months: buckets,
      totalRolling,
      totalAnual: totalRolling, // Compatibilidad retroactiva
    });

  } catch (error: any) {
    return errorResponse(error, "Error al generar el reporte mensual");
  }
}

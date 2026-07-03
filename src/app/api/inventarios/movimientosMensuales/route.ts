import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/apiError';
import { requireEmpleado, esRespuestaError } from '@/lib/auth';

const MESES_LABEL = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const MESES_VENTANA = 6;

// GET /api/inventarios/movimientosMensuales
// Valor (Bs) de los movimientos de kardex de los últimos 6 meses, agrupados
// por motivo: Compra (entradas), Venta (consumo por ventas) y Merma
// (pérdidas). Es el indicador de merma que faltaba en el dashboard de
// Inventario — antes este gráfico mostraba datos de ejemplo sin conexión a
// la base de datos.
export async function GET() {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = BigInt(sesion.sucursalId);

    const ahora = new Date();
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - (MESES_VENTANA - 1), 1);

    const filas = await prisma.$queryRaw<
      { anio: number; mes: number; motivo: string; valor: number | null }[]
    >`
      SELECT YEAR(creado_en) as anio, MONTH(creado_en) as mes, motivo,
             SUM(cantidad * COALESCE(costo_unit, 0)) as valor
      FROM movimientoInventario
      WHERE sucursal_id = ${sucursalId}
        AND creado_en >= ${inicio}
        AND motivo IN ('Compra', 'Venta', 'Merma')
      GROUP BY YEAR(creado_en), MONTH(creado_en), motivo
    `;

    // Construimos los últimos 6 buckets mes a mes, en orden cronológico,
    // para que siempre haya 6 columnas aunque algún mes no tenga movimientos.
    const buckets: { anio: number; mes: number; label: string }[] = [];
    for (let i = MESES_VENTANA - 1; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      buckets.push({
        anio: fecha.getFullYear(),
        mes: fecha.getMonth() + 1,
        label: MESES_LABEL[fecha.getMonth()],
      });
    }

    const valorPorClave = new Map<string, number>();
    for (const fila of filas) {
      valorPorClave.set(`${fila.anio}-${fila.mes}-${fila.motivo}`, Number(fila.valor ?? 0));
    }

    const compras = buckets.map((b) => valorPorClave.get(`${b.anio}-${b.mes}-Compra`) ?? 0);
    const consumo = buckets.map((b) => valorPorClave.get(`${b.anio}-${b.mes}-Venta`) ?? 0);
    const mermas = buckets.map((b) => valorPorClave.get(`${b.anio}-${b.mes}-Merma`) ?? 0);

    const totalMermas = mermas.reduce((a, b) => a + b, 0);
    const totalConsumo = consumo.reduce((a, b) => a + b, 0);
    // % de merma sobre el consumo total del periodo — la cifra que el
    // diagnóstico del proyecto pedía y que hoy no existía en ningún reporte.
    const mermaPctSobreConsumo = totalConsumo > 0 ? (totalMermas / totalConsumo) * 100 : 0;

    return NextResponse.json({
      success: true,
      labels: buckets.map((b) => b.label),
      compras,
      consumo,
      mermas,
      totalMermas,
      mermaPctSobreConsumo,
    });
  } catch (error) {
    return errorResponse(error, 'Error al obtener los movimientos mensuales de inventario');
  }
}

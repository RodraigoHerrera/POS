import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { parsePeriodo, rangoPeriodo } from "@/lib/periodo";

// GET /api/ventas/topProductos
// Top 5 productos por cantidad vendida en el mes actual (o la semana actual con ?periodo=semana), desde
// historialVentas (snapshot de ventas ya facturadas). Pensado para el
// dashboard: responde "qué se vende más" sin tener que ir a Informes.
export async function GET(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;

    const periodo = parsePeriodo(new URL(req.url).searchParams.get("periodo"));
    const { inicio: inicioMes, fin: finMes } = rangoPeriodo(periodo);

    const top = await prisma.historialVentas.groupBy({
      by: ["producto_id", "producto_nombre"],
      where: {
        sucursal_id: BigInt(sucursalId),
        fecha_venta: { gte: inicioMes, lte: finMes },
      },
      _sum: { cantidad: true, venta_total: true },
      orderBy: { _sum: { cantidad: "desc" } },
      take: 5,
    });

    const data = top.map((row) => ({
      productoId: row.producto_id.toString(),
      nombre: row.producto_nombre,
      cantidad: row._sum.cantidad ?? 0,
      ventaTotal: Number(row._sum.venta_total ?? 0),
    }));

    return NextResponse.json({ success: true, periodo, data });
  } catch (error) {
    return errorResponse(error, "Error al obtener el top de productos vendidos");
  }
}

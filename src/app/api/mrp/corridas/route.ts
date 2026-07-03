import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// Historial de corridas de MRP de la sucursal, para trazabilidad ("¿qué se
// corrió y cuándo?"). El detalle de cada una vive en /api/mrp/corridas/[id].
export async function GET() {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const corridas = await prisma.mrpCorrida.findMany({
      where: { sucursal_id: BigInt(sesion.sucursalId) },
      orderBy: { creado_en: "desc" },
      take: 30,
      select: {
        id: true,
        horizonte_dias: true,
        metodo: true,
        creado_en: true,
        _count: { select: { necesidades: true, ordenesGeneradas: true } },
      },
    });

    return NextResponse.json({ success: true, data: serializeBigInt(corridas) });
  } catch (error: any) {
    return errorResponse(error, "Error al obtener el historial de corridas de MRP");
  }
}

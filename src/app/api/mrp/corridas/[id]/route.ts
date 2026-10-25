import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { respuestaDeError } from "@/lib/mrp/respuestaError";
import { parseCorridaId } from "@/lib/mrp/validacion";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// Detalle completo de una corrida de MRP: pronóstico/MPS por producto,
// necesidades por insumo y las órdenes de compra que generó.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalId = sesion.sucursalId;

    const { id } = await context.params;
    const corrida = await prisma.mrpCorrida.findUnique({
      where: { id: parseCorridaId(id) },
      include: {
        forecastDetalle: { include: { producto: { select: { nombre: true } } } },
        necesidades: { include: { item: { select: { nombre: true, unidad_code: true } } } },
        ordenesGeneradas: {
          include: {
            proveedor: { select: { nombre: true } },
            items: { include: { item: { select: { nombre: true, unidad_code: true } } } },
          },
        },
      },
    });

    if (!corrida || corrida.sucursal_id.toString() !== sucursalId) {
      return NextResponse.json({ error: "Corrida no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: serializeBigInt(corrida) });
  } catch (error: unknown) {
    return respuestaDeError(error, "Error al obtener el detalle de la corrida de MRP");
  }
}

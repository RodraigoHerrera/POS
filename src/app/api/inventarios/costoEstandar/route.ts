import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// PATCH /api/inventarios/costoEstandar  { itemId, costoEstandar: number | null }
// Fija (o limpia, con null) el costo estándar de un insumo, usado por el
// costeo teórico en vez de costo_promedio. Solo Administrador.
export async function PATCH(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const body = await req.json();
    const { itemId, costoEstandar } = body;
    if (!itemId) {
      return NextResponse.json({ message: "Falta itemId" }, { status: 400 });
    }

    const item = await prisma.item.update({
      where: { id: BigInt(itemId) },
      data: {
        costo_estandar:
          costoEstandar === null || costoEstandar === undefined || costoEstandar === ""
            ? null
            : Number(costoEstandar),
      },
      select: { id: true, costo_estandar: true },
    });

    return NextResponse.json({
      success: true,
      itemId: item.id.toString(),
      costoEstandar: item.costo_estandar !== null ? Number(item.costo_estandar) : null,
    });
  } catch (error) {
    return errorResponse(error, "Error al fijar el costo estándar");
  }
}

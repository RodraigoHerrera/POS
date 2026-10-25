import { NextResponse } from "next/server";
import { calcularCostoTeoricoUnitario } from "@/lib/costeo";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/recetas/costoTeorico?itemId=<itemVendibleId>
// Costo teórico (BOM x costo_promedio actual) de una unidad del item vendible,
// en la sucursal de la sesión activa.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) {
      return NextResponse.json({ message: "Falta itemId" }, { status: 400 });
    }

    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { costoTeoricoUnitario, detalle } = await calcularCostoTeoricoUnitario(
      BigInt(itemId),
      BigInt(sesion.sucursalId)
    );

    return NextResponse.json({
      success: true,
      costoTeoricoUnitario,
      detalle: detalle.map((d) => ({ ...d, itemInsumoId: d.itemInsumoId })),
    });
  } catch (error) {
    return errorResponse(error, "Error al calcular el costo teórico");
  }
}

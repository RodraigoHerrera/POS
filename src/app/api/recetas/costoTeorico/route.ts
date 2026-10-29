import { NextResponse } from "next/server";
import {
  calcularCostoTeoricoUnitario,
  calcularCostosTeoricosUnitarios,
} from "@/lib/costeo";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/recetas/costoTeorico?itemId=<itemVendibleId>
// Modo batch:
// GET /api/recetas/costoTeorico?itemIds=1,2,3... o sin parámetros (todas las recetas)
// Costo teórico (BOM x costo_promedio actual) de la receta en la sucursal de la sesión activa.
export async function GET(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    // Consulta individual (mantiene retrocompatibilidad y devuelve detalle por insumo)
    if (itemId) {
      if (!/^\d+$/.test(itemId)) {
        return NextResponse.json({ message: "itemId inválido" }, { status: 400 });
      }

      const { costoTeoricoUnitario, detalle } = await calcularCostoTeoricoUnitario(
        BigInt(itemId),
        BigInt(sesion.sucursalId)
      );

      return NextResponse.json({
        success: true,
        costoTeoricoUnitario,
        detalle: detalle.map((d) => ({ ...d, itemInsumoId: d.itemInsumoId })),
      });
    }

    // Consulta batch: múltiples items o todas las recetas de la sucursal
    const itemIdsParam = searchParams.get("itemIds");
    const itemIds = itemIdsParam
      ? itemIdsParam
          .split(",")
          .map((id) => id.trim())
          .filter((id) => /^\d+$/.test(id))
          .map((id) => BigInt(id))
      : undefined;

    const costos = await calcularCostosTeoricosUnitarios(
      BigInt(sesion.sucursalId),
      itemIds
    );

    return NextResponse.json({
      success: true,
      costos,
    });
  } catch (error) {
    return errorResponse(error, "Error al calcular el costo teórico");
  }
}

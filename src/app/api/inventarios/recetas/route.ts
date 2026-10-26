import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import {
  parsePositiveBigInt,
  ValidationError,
  validationErrorResponse,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/inventarios/recetas?itemVendibleId=<id>
// Lista los insumos (recetaItem) de la receta de un item vendible. Lo usa el
// editor de recetas del admin para precargar las filas existentes.
// Devuelve [] si el producto no tiene receta.
export async function GET(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { searchParams } = new URL(req.url);
    const itemVendibleId = parsePositiveBigInt(
      searchParams.get("itemVendibleId"),
      "itemVendibleId"
    );

    const receta = await prisma.receta.findUnique({
      where: { item_vendible_id: itemVendibleId },
      select: {
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            item_insumo_id: true,
            cantidad: true,
            merma_pct: true,
            item_insumo: { select: { nombre: true, unidad_code: true } },
          },
        },
      },
    });

    const resultado = (receta?.items ?? []).map((ri) => ({
      id: ri.id,
      itemInsumoId: ri.item_insumo_id,
      nombre: ri.item_insumo.nombre,
      unidad_code: ri.item_insumo.unidad_code,
      cantidad: ri.cantidad,
      merma_pct: ri.merma_pct,
    }));

    return NextResponse.json(serializeBigInt(resultado));
  } catch (error) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }
    return errorResponse(error, "Error al obtener la receta del producto");
  }
}

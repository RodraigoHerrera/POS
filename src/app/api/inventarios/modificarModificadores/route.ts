import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { errorResponse } from "@/lib/apiError";
import {
  parsePositiveBigInt,
  validateModificadores,
  ValidationError,
  validationErrorResponse,
} from "@/lib/validation";

// PUT /api/inventarios/modificarModificadores
// body: { id: <itemVendibleId>, modificadores: [{ itemId, cantidad, precio }] }
// Reemplaza todos los extras (modificadorProducto) configurados para un item
// vendible, igual que modificarReceta hace con los insumos de la receta.
export async function PUT(request: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const body = await request.json();
    const { id: idItemVendible, modificadores } = body;

    const itemVendibleId = parsePositiveBigInt(idItemVendible, "ID del producto");
    const validModificadores = validateModificadores(modificadores);

    await prisma.$transaction(async (tx) => {
      await tx.modificadorProducto.deleteMany({
        where: { item_vendible_id: itemVendibleId },
      });

      if (validModificadores.length > 0) {
        await tx.modificadorProducto.createMany({
          data: validModificadores.map((extra) => ({
            item_vendible_id: itemVendibleId,
            item_insumo_id: extra.itemId,
            delta_cantidad: extra.cantidad,
            precio: extra.precio,
          })),
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Extras actualizados correctamente",
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }
    return errorResponse(error, "Error interno al procesar los extras");
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { errorResponse } from "@/lib/apiError";

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

    if (!idItemVendible) {
      return NextResponse.json({ error: "Falta ID del producto" }, { status: 400 });
    }

    const itemVendibleId = BigInt(idItemVendible);

    await prisma.$transaction(async (tx) => {
      await tx.modificadorProducto.deleteMany({
        where: { item_vendible_id: itemVendibleId },
      });

      if (modificadores && modificadores.length > 0) {
        await tx.modificadorProducto.createMany({
          data: modificadores.map((extra: any) => ({
            item_vendible_id: itemVendibleId,
            item_insumo_id: BigInt(extra.itemId),
            delta_cantidad: Number(extra.cantidad),
            precio: Number(extra.precio) || 0,
          })),
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Extras actualizados correctamente",
    });
  } catch (error) {
    return errorResponse(error, "Error interno al procesar los extras");
  }
}

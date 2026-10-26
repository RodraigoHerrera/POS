import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { errorResponse } from "@/lib/apiError";
import {
  parsePositiveBigInt,
  validateReceta,
  ValidationError,
  validationErrorResponse,
} from "@/lib/validation";

export async function PUT(request: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    // 1. Leemos el JSON exacto que envía el frontend
    const body = await request.json();
    
    // Desestructuramos: "id" es el ID del producto vendible (ej: "7")
    const { id: idProductoVendible, receta } = body;

    // Validación estricta antes de la transacción
    const itemVendibleId = parsePositiveBigInt(idProductoVendible, "ID del producto");
    const validReceta = validateReceta(receta);

    // 2. Iniciamos la transacción de base de datos
    // Esto hace: Buscar/Crear Cabecera -> Borrar Items Viejos -> Crear Items Nuevos
    await prisma.$transaction(async (tx) => {
      
      // --- PASO A: Gestionar la tabla 'receta' (Cabecera) ---
      
      // Buscamos si ya existe una receta para el producto
      let recetaHeader = await tx.receta.findFirst({
        where: { item_vendible_id: itemVendibleId },
      });

      // Si no existe, la creamos
      if (!recetaHeader) {
        recetaHeader = await tx.receta.create({
          data: {
            item_vendible_id: itemVendibleId,
            rendimiento: 1, // Default: Rinde 1 unidad
            merma_pct: 0,   // Default: 0% merma
          },
        });
      }

      // --- PASO B: Gestionar la tabla 'recetaitem' (Detalles) ---

      // Primero: LIMPIEZA. Borramos los ingredientes viejos de esta receta.
      await tx.recetaItem.deleteMany({
        where: { receta_id: recetaHeader.id },
      });

      // Segundo: INSERCIÓN. Si vienen items validados, los creamos.
      if (validReceta.length > 0) {
        const itemsParaGuardar = validReceta.map((insumo) => ({
          receta_id: recetaHeader.id,
          item_insumo_id: Number(insumo.itemId),
          cantidad: insumo.cantidad,
          merma_pct: insumo.merma_pct,
        }));

        await tx.recetaItem.createMany({
          data: itemsParaGuardar,
        });
      }

      return recetaHeader;
    });

    return NextResponse.json({ 
      success: true, 
      message: "Receta actualizada correctamente",
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }
    return errorResponse(error, "Error interno al procesar la receta");
  }
}

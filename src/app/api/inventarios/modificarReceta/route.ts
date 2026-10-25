import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export async function PUT(request: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    // 1. Leemos el JSON exacto que envía el frontend
    const body = await request.json();
    
    // Desestructuramos: "id" es el ID del producto vendible (ej: "7")
    const { id: idProductoVendible, receta } = body;

    // Validación básica
    if (!idProductoVendible) {
      return NextResponse.json({ error: "Falta ID del producto" }, { status: 400 });
    }

    // Convertimos el ID que viene como string ("7") a número (7)
    const itemVendibleIdInt = parseInt(idProductoVendible, 10);

    // 2. Iniciamos la transacción de base de datos
    // Esto hace: Buscar/Crear Cabecera -> Borrar Items Viejos -> Crear Items Nuevos
    const resultado = await prisma.$transaction(async (tx) => {
      
      // --- PASO A: Gestionar la tabla 'receta' (Cabecera) ---
      
      // Buscamos si ya existe una receta para el "Vaso de coca cola"
      let recetaHeader = await tx.receta.findFirst({
        where: { item_vendible_id: itemVendibleIdInt },
      });

      // Si no existe, la creamos
      if (!recetaHeader) {
        recetaHeader = await tx.receta.create({
          data: {
            item_vendible_id: itemVendibleIdInt,
            rendimiento: 1, // Default: Rinde 1 unidad
            merma_pct: 0,   // Default: 0% merma
          },
        });
      }

      // --- PASO B: Gestionar la tabla 'recetaitem' (Detalles) ---

      // Primero: LIMPIEZA. Borramos los ingredientes viejos de esta receta.
      // Esto es más seguro que intentar actualizar uno por uno.
      await tx.recetaItem.deleteMany({
        where: { receta_id: recetaHeader.id },
      });

      // Segundo: INSERCIÓN. Si vienen items en el JSON, los creamos.
      if (receta && receta.length > 0) {
        // Preparamos los datos convirtiendo strings a números
        const itemsParaGuardar = receta.map((insumo: any) => ({
          receta_id: recetaHeader!.id,           // ID de la cabecera (int)
          item_insumo_id: parseInt(insumo.itemId, 10), // "5" -> 5
          cantidad: Number(insumo.cantidad),     // 0.5 -> 0.5 (Decimal/Float)
          merma_pct: 0,                          // Default
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
    console.error("Error en modificarReceta:", error);
    return NextResponse.json(
      { error: "Error interno al procesar la receta" },
      { status: 500 }
    );
  }
}
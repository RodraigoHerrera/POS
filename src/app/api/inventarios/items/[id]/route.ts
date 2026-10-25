import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { serializeBigInt } from "@/lib/serialize";

// Tarea 2: PUT para edición
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { id } = await params;
    const itemId = BigInt(id);
    const body = await request.json();

    // 1. Validar que el item exista
    const itemExistente = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!itemExistente) {
      return NextResponse.json({ message: "Ítem no encontrado" }, { status: 404 });
    }

    // 2. Proteger campos inmutables
    if (body.tipo && body.tipo !== itemExistente.tipo) {
      return NextResponse.json(
        { message: "No se puede modificar el tipo de un ítem existente." },
        { status: 400 }
      );
    }

    let unidad_code = itemExistente.unidad_code;

    // 3. Condicionalmente bloquear unidad_code
    if (body.unidad_code && body.unidad_code !== itemExistente.unidad_code) {
      const movimientos = await prisma.movimientoInventario.count({
        where: { item_id: itemId },
      });
      const stock = await prisma.inventarioSucursal.count({
        where: { item_id: itemId },
      });

      if (movimientos > 0 || stock > 0) {
        return NextResponse.json(
          { message: "No se puede cambiar la unidad de medida porque el ítem ya tiene historial o stock." },
          { status: 400 }
        );
      }
      unidad_code = body.unidad_code;
    }

    // 4. Actualizar
    const itemActualizado = await prisma.item.update({
      where: { id: itemId },
      data: {
        nombre: body.nombre?.trim() ?? itemExistente.nombre,
        sku: body.sku !== undefined ? body.sku : itemExistente.sku,
        unidad_code,
      },
    });

    return NextResponse.json(serializeBigInt(itemActualizado));
  } catch (error: any) {
    console.error("Error editando item:", error);
    return NextResponse.json(
      { message: error?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// Tarea 3: PATCH para Soft Delete (Borrado lógico)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { id } = await params;
    const itemId = BigInt(id);
    const body = await request.json();
    
    if (typeof body.activo !== 'boolean') {
      return NextResponse.json({ message: "Debe proveer el campo activo (boolean)" }, { status: 400 });
    }

    const itemDesactivado = await prisma.item.update({
      where: { id: itemId },
      data: {
        activo: body.activo,
      },
    });

    return NextResponse.json(serializeBigInt(itemDesactivado));
  } catch (error: any) {
    console.error("Error cambiando estado del item:", error);
    return NextResponse.json(
      { message: error?.message || "Error interno del servidor" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { id } = await params;
    const body = await request.json();
    const { nombre, sku, tipo, unidad_code } = body;

    if (!nombre || !tipo || !unidad_code) {
      return NextResponse.json(
        { message: "Faltan campos requeridos: nombre, tipo, unidad_code" },
        { status: 400 }
      );
    }

    // SKU uniqueness check — exclude current item
    if (sku) {
      const existing = await prisma.item.findFirst({
        where: {
          sku,
          id: { not: BigInt(id) },
        },
      });
      if (existing) {
        return NextResponse.json(
          { message: "Ya existe un item con ese SKU" },
          { status: 409 }
        );
      }
    }

    const updatedItem = await prisma.item.update({
      where: { id: BigInt(id) },
      data: {
        nombre,
        sku: sku ?? null,
        tipo,
        unidad_code,
      },
    });

    return NextResponse.json(
      {
        success: true,
        item: serializeBigInt(updatedItem),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("PUT /api/inventarios/items/[id] error:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

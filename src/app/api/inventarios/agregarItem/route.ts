// src/app/api/items/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Crea un nuevo item en el catálogo de inventario
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Campos esperados
    const {
      tipo,          // Debe coincidir con el enum Prisma: TipoItem (p.ej. "INSUMO" | "VENDIBLE" | "ENVASE" ... según tu schema)
      nombre,
      sku,           // opcional (único)
      unidad_code,   // p.ej. "kg", "g", "u", "lt", etc.
      activo = true, // opcional, por defecto true
    } = body;

    // Validaciones mínimas (solo requeridos)
    if (!tipo || !nombre || !unidad_code) {
      return NextResponse.json(
        { message: "Faltan campos requeridos: tipo, nombre, unidad_code" },
        { status: 400 }
      );
    }

    // Si viene sku, verificar unicidad (evitamos error 409 del unique)
    if (sku) {
      const existing = await prisma.item.findUnique({ where: { sku } });
      if (existing) {
        return NextResponse.json(
          { message: "Ya existe un item con ese SKU" },
          { status: 409 }
        );
      }
    }

    // Crear el item
    const nuevoItem = await prisma.item.create({
      data: {
        tipo,        // enum TipoItem
        nombre,
        sku: sku ?? null,
        unidad_code,
        activo,
      },
    });

    // Serializar BigInt para la respuesta
    return NextResponse.json(
      {
        message: "Item creado con éxito",
        item: {
          ...nuevoItem,
          id: nuevoItem.id.toString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    // Posible error por enum inválido u otras constraints
    console.error("POST /api/items error:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

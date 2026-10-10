import { NextResponse } from "next/server";
// IMPORTANTE: Ajusta esta importación a donde tengas tu instancia de Prisma o conexión a BD
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// Esto asegura que la API no se guarde en caché y siempre traiga datos frescos
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "true";

    // Consulta a la base de datos
    const items = await prisma.item.findMany({
      where: {
        ...(includeAll ? {} : { activo: true }),
      },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        sku: true,
        unidad_code: true,
        costo_estandar: true,
        activo: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    return NextResponse.json(serializeBigInt(items));

  } catch (error) {
    console.error("Error obteniendo items:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al obtener items" },
      { status: 500 }
    );
  }
}
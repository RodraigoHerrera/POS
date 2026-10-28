import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// Esto asegura que la API no se guarde en caché y siempre traiga datos frescos
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Catálogo de venta: lo usa tanto el cajero (POS) como el admin, por eso
    // no se restringe por rol — solo se exige estar autenticado como empleado.
    const sesion = await requireEmpleado();
    if (esRespuestaError(sesion)) return sesion;

    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "true";

    // Si includeAll = true (admin en /admin/menu), trae todos.
    // Si no (cajero/POS en /cajero/ventas), solo trae los productos con estado activo
    // y cuyo item vinculado en inventario (si existe) también esté activo.
    const items = await prisma.producto.findMany({
      where: includeAll
        ? {}
        : {
            estado: "activo",
            OR: [
              { item_inventario_id: null },
              { item_inventario: { activo: true } },
            ],
          },
      select: {
        id: true,
        nombre: true, 
        descripcion: true,
        categoria: true,
        imagenUrl: true,
        precio: true,
        estado: true,
        item_inventario_id: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    return NextResponse.json(serializeBigInt(items));

  } catch (error) {
    console.error("Error obteniendo productos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al obtener productos" },
      { status: 500 }
    );
  }
}

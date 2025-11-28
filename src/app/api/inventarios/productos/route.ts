import { NextResponse } from "next/server";
import { prisma } from "@/lib/db"; 

// Esto asegura que la API no se guarde en caché y siempre traiga datos frescos
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Consulta a la base de datos
    const items = await prisma.producto.findMany({
      where: {
        // Opcional: Solo traer items activos si tienes esa columna
        // activo: true, 
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
        // Puedes traer más datos si los necesitas para mostrarlos en el select
        // codigo: true, 
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    // CORRECCIÓN: Convertir BigInt a String
    // JSON.stringify no soporta BigInt nativamente, por lo que da error.
    // Mapeamos los items y convertimos el ID a string.
    const safeItems = items.map((item) => ({
      ...item,
      id: item.id.toString(),
      item_inventario_id: item.item_inventario_id?.toString(),
    }));

    return NextResponse.json(safeItems);

  } catch (error) {
    console.error("Error obteniendo items:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al obtener items" },
      { status: 500 }
    );
  }
}
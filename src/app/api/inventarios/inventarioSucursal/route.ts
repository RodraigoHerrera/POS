import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {

  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const sucursalIdStr = sesion.sucursalId;

    // 1. Usamos findMany para traer la lista completa
    const inventarioBruto = await prisma.inventarioSucursal.findMany({
      where: {
        sucursal_id: BigInt(sucursalIdStr), // Mantenemos el filtro por sucursal
        // Ya no filtramos por nombre de item, así que trae todos
      },
      select: {
        item_id: true,
        stock: true,
        stock_min: true,
        // Accedemos a la relación para sacar los datos del producto
        item: {
          select: {
            nombre: true,      // <--- IMPORTANTE: Pedimos el nombre
            unidad_code: true, // "kg", "u", etc.
            sku: true          // Opcional: útil para búsquedas
          }
        }
      },
      // Opcional: Ordenar alfabéticamente para que se vea ordenado en pantalla
      orderBy: {
        item: {
          nombre: 'asc'
        }
      }
    });

    // 2. Aplanamos la respuesta (Formateo)
    // Prisma devuelve estructuras anidadas (item dentro de inventario).
    // Es mejor enviarle al frontend una lista plana.
    const inventarioLimpio = inventarioBruto.map((registro) => ({
      itemId: registro.item_id.toString(), // BigInt -> string
      nombre: registro.item.nombre,
      stock: Number(registro.stock), // Convertimos Decimal de Prisma a Number de JS
      stockMin: Number(registro.stock_min),
      unidad: registro.item.unidad_code,
      sku: registro.item.sku
    }));

    return NextResponse.json(inventarioLimpio);

  } catch (error) {
    console.error("Error obteniendo inventario:", error);
    return NextResponse.json(
      { error: "Error al cargar el inventario" }, 
      { status: 500 }
    );
  }
}
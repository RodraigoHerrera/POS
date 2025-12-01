import { NextResponse } from "next/server";
import { prisma } from "@/lib/db"; 
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function getSucursalIdFromToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    // En tu login firmamos sucursalId como string, no number
    return (payload as any)?.sucursalId as string | undefined;
  } catch (error) {
    return null;
  }
}


export const dynamic = 'force-dynamic';

export async function GET() {
  
  try {

        const cookieStore = await cookies();
          const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
        
          if (!tokenSucursal) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 });
          }
        
          const sucursalIdStr = await getSucursalIdFromToken(tokenSucursal);
        
          if (!sucursalIdStr) {
            return NextResponse.json({ message: "Token inválido" }, { status: 403 });
          }
    
    
    // 1. Usamos findMany para traer la lista completa
    const inventarioBruto = await prisma.inventarioSucursal.findMany({
      where: {
        sucursal_id: BigInt(sucursalIdStr), // Mantenemos el filtro por sucursal
        // Ya no filtramos por nombre de item, así que trae todos
      },
      select: {
        stock: true,
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
      nombre: registro.item.nombre,
      stock: Number(registro.stock), // Convertimos Decimal de Prisma a Number de JS
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
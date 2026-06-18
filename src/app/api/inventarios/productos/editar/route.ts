import { NextResponse } from 'next/server';
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";

// --- SOLUCIÓN BIGINT ---
// Esto define cómo se debe comportar BigInt al convertirse a JSON.
// Lo convertimos a string para no perder precisión y evitar el error.
// @ts-ignore
BigInt.prototype.toJSON = function () { 
  return this.toString(); 
};
// -----------------------

// Definimos la interfaz para tipar los datos entrantes
interface ProductUpdateData {
  id: number | string; // Aceptamos string o number por si acaso
  nombre: string;
  precio: string | number;
  estado: string;
  categoria: string;
  descripcion: string;
  fotoUrl?: string;
}

export async function PUT(request: Request) {
  try {
    // 1. Parsear el cuerpo de la petición
    const body: ProductUpdateData = await request.json();
    
    // Desestructuramos los datos
    const { id, nombre, precio, estado, categoria, descripcion, fotoUrl } = body;

    // 2. Validación básica
    if (!id) {
      return NextResponse.json(
        { message: 'El ID del producto es obligatorio para la edición.' },
        { status: 400 }
      );
    }

    // 3. ACTUALIZACIÓN CON PRISMA
    const updatedProduct = await prisma.producto.update({
      where: { 
        id: Number(id) // Aseguramos que para la query sea un número (si tu DB espera BigInt, Prisma lo convierte solo)
      },
      data: {
        nombre,
        // Conversión segura de precio:
        // Si tu base de datos usa DECIMAL/FLOAT, pásalo como Number o String (Prisma Decimal prefiere String para precisión)
        // Si tienes problemas con el precio también, usa String(precio)
        precio: typeof precio === 'string' ? parseFloat(precio) : precio, 
        estado,
        categoria,
        descripcion,
        ...(fotoUrl && { fotoUrl }),
      }
    });
    
    console.log(`[API] Producto ID ${id} actualizado.`);

    // 4. Retornar el producto actualizado
    // Ahora esto funcionará porque el BigInt se convertirá a String automáticamente
    return NextResponse.json(updatedProduct);

  } catch (error: any) {
    console.error('[API Error] Fallo al actualizar producto:', error);
    
    // Manejo de errores específicos de Prisma
    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'El producto a editar no existe.' },
        { status: 404 }
      );
    }
    
    return errorResponse(error, "Error interno del servidor.");
  }
}
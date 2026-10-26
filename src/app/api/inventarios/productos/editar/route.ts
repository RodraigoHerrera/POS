import { NextResponse } from 'next/server';
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import {
  parsePositiveBigInt,
  parseNonNegativeNumber,
  ValidationError,
  validationErrorResponse,
} from "@/lib/validation";

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
  id: number | string;
  nombre: string;
  precio: string | number;
  estado: string;
  categoria: string;
  descripcion: string;
  fotoUrl?: string;
}

export async function PUT(request: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    // 1. Parsear el cuerpo de la petición
    const body: ProductUpdateData = await request.json();
    
    // Desestructuramos los datos
    const { id, nombre, precio, estado, categoria, descripcion, fotoUrl } = body;

    // 2. Validación de cotas no negativas y tipos seguros
    const validId = parsePositiveBigInt(id, "ID del producto");
    const validPrecio = parseNonNegativeNumber(precio, "Precio del producto");

    // 3. ACTUALIZACIÓN CON PRISMA
    const updatedProduct = await prisma.producto.update({
      where: { 
        id: Number(validId)
      },
      data: {
        nombre,
        precio: validPrecio,
        estado,
        categoria,
        descripcion,
        ...(fotoUrl && { fotoUrl }),
      }
    });
    
    console.log(`[API] Producto ID ${validId.toString()} actualizado.`);

    // 4. Retornar el producto actualizado
    return NextResponse.json(updatedProduct);

  } catch (error: any) {
    if (error instanceof ValidationError) {
      return validationErrorResponse(error);
    }

    console.error('[API Error] Fallo al actualizar producto:', error);
    
    // Manejo de errores específicos de Prisma
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { message: 'El producto a editar no existe.' },
        { status: 404 }
      );
    }
    
    return errorResponse(error, "Error interno del servidor.");
  }
}

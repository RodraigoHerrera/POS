import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    // Consulta a la base de datos
    // Asumimos que tu modelo en schema.prisma se llama "proveedor"
    const proveedores = await prisma.proveedor.findMany({
      where: {
        // activo: true, // Descomentar si tienes un campo de estado
      },
      select: {
        id: true,
        nombre: true, // Usamos razon_social como etiqueta para el select
        // nombre: true, // Si usas 'nombre' en vez de 'razon_social', cambia la línea de arriba
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    return NextResponse.json(serializeBigInt(proveedores));

  } catch (error) {
    console.error("Error obteniendo proveedores:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al obtener proveedores" },
      { status: 500 }
    );
  }
}
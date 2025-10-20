// /app/api/usuarios/[id]/route.ts
import { prisma } from "@/lib/db";
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // Esperar a que se resuelvan los parámetros dinámicos
    const { id } = await context.params;
    // Convertir el id a BigInt para la consulta en Prisma
    const empleadoId = BigInt(id);
    const empleado = await prisma.empleados.findUnique({
      where: { id: empleadoId },
      select: { nombre: true },
    });

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ nombre: empleado.nombre });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al obtener el empleado' }, { status: 500 });
  }
}

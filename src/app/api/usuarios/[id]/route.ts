// /app/api/usuarios/[id]/route.ts
import { prisma } from "@/lib/db";
import { NextResponse } from 'next/server';
import { requireSucursal, esRespuestaError } from "@/lib/auth";
import { empleadoParaPin } from "@/lib/empleadosKiosco";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Solo con sesión de sucursal, y solo empleados de ESA sucursal: esta
    // ruta alimenta la pantalla de PIN (pre-empleado), pero sin el filtro
    // cualquiera podía enumerar nombres/usuarios de todas las sucursales.
    const sesion = await requireSucursal();
    if (esRespuestaError(sesion)) return sesion;

    // Esperar a que se resuelvan los parámetros dinámicos
    const { id } = await context.params;
    // Convertir el id a BigInt para la consulta en Prisma
    const empleadoId = BigInt(id);
    const empleado = await prisma.empleados.findFirst({
      where: { id: empleadoId, sucursal_id: BigInt(sesion.sucursalId) },
      select: { usuario: true, estado: true },
    });

    // Igual que el kiosco: sin nombre completo y sin empleados dados de baja
    const vista = empleadoParaPin(empleado);
    if (!vista) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    return NextResponse.json(vista);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al obtener el empleado' }, { status: 500 });
  }
}

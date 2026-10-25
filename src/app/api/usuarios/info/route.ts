import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

export async function GET() {
  try {
    const sesion = await requireEmpleado();
    if (esRespuestaError(sesion)) {
      return NextResponse.json(
        { error: "No autorizado", message: "No autorizado" },
        { status: 401 }
      );
    }

    const empleado = await prisma.empleados.findFirst({
      where: {
        id: BigInt(sesion.empleadoId),
        sucursal_id: BigInt(sesion.sucursalId),
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        usuario: true,
        correo: true,
      },
    });

    if (!empleado) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      nombre: empleado.nombre,
      rol: empleado.rol,
      fotoUrl: "/default-user.jpg",
      correo: empleado.correo,
      usuario: empleado.usuario,
    });
  } catch (error) {
    console.error("Error leyendo información del empleado:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

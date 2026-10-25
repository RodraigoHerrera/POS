import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSucursal, esRespuestaError } from "@/lib/auth";
import { empleadosParaKiosco } from "@/lib/empleadosKiosco";

// Alimenta la pantalla de selección de empleado (pre-PIN). Solo requiere la
// sesión de sucursal, por eso devuelve la vista mínima: activos, sin contacto.
export async function GET() {
  const sesion = await requireSucursal();
  if (esRespuestaError(sesion)) return sesion;

  try {
    const empleados = await prisma.empleados.findMany({
      where: { sucursal_id: BigInt(sesion.sucursalId) },
      select: { id: true, usuario: true, rol: true, estado: true },
      orderBy: { nombre: "asc" },
    });

    return NextResponse.json(empleadosParaKiosco(empleados));
  } catch (error) {
    console.error("Error al obtener empleados para el kiosco:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}

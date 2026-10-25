import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// Listado completo (con datos de contacto) para la administración de usuarios.
// La pantalla de selección pre-PIN usa /api/usuarios/kiosco.
export async function GET() {
  const sesion = await requireEmpleado(["Administrador"]);
  if (esRespuestaError(sesion)) return sesion;

  try {
    // Prisma espera BigInt en sucursal_id
    const empleados = await prisma.empleados.findMany({
      where: { sucursal_id: BigInt(sesion.sucursalId) },
      select: {
        id: true,
        nombre: true,
        rol: true,
        estado: true,
        correo: true,
        celular: true,
        creado: true,
        usuario: true
      },
      orderBy: { nombre: "asc" },
    });

    // Normalizamos: id a string y foto por defecto
    const empleadosConFoto = empleados.map((e) => ({
      id: e.id.toString(),
      nombre: e.nombre,
      fotoUrl: "/default-user.jpg",
      rol: e.rol,
      estado: e.estado,
      correo: e.correo,
      celular: e.celular,
      creado: e.creado,
      usuario: e.usuario
    }));

    return NextResponse.json(empleadosConFoto);
  } catch (error) {
    console.error("Error al obtener empleados:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}

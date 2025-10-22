import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenEmpleado = cookieStore.get("tokenEmpleado")?.value;

    if (!tokenEmpleado) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(tokenEmpleado, secret) as {
      empleadoId: string;
    };

    const empleado = await prisma.empleados.findUnique({
      where: { id: BigInt(payload.empleadoId) },
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
    });
  } catch (error) {
    console.error("Error leyendo tokenEmpleado:", error);
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
  }
}

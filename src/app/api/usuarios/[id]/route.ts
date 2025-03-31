import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const empleado = await prisma.empleado.findUnique({
      where: { id: Number(params.id) },
      select: { nombre: true, id: true },
    });

    if (!empleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      nombre: empleado.nombre,
      id: empleado.id.toString(),
    });
  } catch (error) {
    console.error("Error al obtener empleado:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}

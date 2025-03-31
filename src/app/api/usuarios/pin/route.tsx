import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    if (req.headers.get("content-type") !== "application/json") {
      return NextResponse.json({ message: "Tipo de contenido no válido" }, { status: 400 });
    }

    const { id, pin } = await req.json();

    if (!id || !pin) {
      return NextResponse.json({ message: "Faltan datos" }, { status: 400 });
    }

    const empleado = await prisma.empleado.findUnique({
      where: { id: Number(id) },
    });

    if (!empleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });
    }

    const match = await bcrypt.compare(pin, empleado.contraseña);

    if (!match) {
      return NextResponse.json({ message: "PIN incorrecto" }, { status: 401 });
    }

    return NextResponse.json({ rol: empleado.rol });
  } catch (error) {
    console.error("Error al verificar PIN:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}

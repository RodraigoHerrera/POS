import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, direccion, correo, telefono, contraseña } = body;

    

    const existingSucursal = await prisma.sucursal.findUnique({
      where: { correo },
    });

    if (existingSucursal) {
      return NextResponse.json(
        { message: "Ya existe una sucursal con ese correo" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(contraseña, 10);

    const nuevaSucursal = await prisma.sucursal.create({
      data: {
        nombre,
        direccion,
        correo,
        telefono,
        contraseña: hashedPassword,
      },
    });

    return NextResponse.json(
        {
          message: "Sucursal registrada con éxito",
          sucursal: {
            ...nuevaSucursal,
            id: nuevaSucursal.id.toString(), // 👈 Esto evita el error
          },
        },
        { status: 201 }
      );
  } catch (error) {
    console.error("Error al registrar sucursal:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

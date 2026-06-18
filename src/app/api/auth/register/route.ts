import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, direccion, correo, telefono, contraseña } = body;

    

    const existingSucursal = await prisma.sucursales.findUnique({
      where: { correo },
    });

    if (existingSucursal) {
      return NextResponse.json(
        { message: "Ya existe una sucursal con ese correo" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(contraseña, 10);

    const nuevaSucursal = await prisma.sucursales.create({
      data: {
        nombre,
        direccion,
        correo,
        telefono,
        contrasena: hashedPassword,
      },
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("Falta JWT_SECRET en variables de entorno");
      return NextResponse.json({ message: "Error de configuración" }, { status: 500 });
    }

    const sucursalToken = jwt.sign(
      {
        sucursalId: nuevaSucursal.id.toString(),
        correo: nuevaSucursal.correo,
      },
      secret,
      { expiresIn: "8h" }
    );

    const response = NextResponse.json(
        {
          message: "Sucursal registrada con éxito",
          sucursal: serializeBigInt(nuevaSucursal),
        },
        { status: 201 }
      );

    response.cookies.set("tokenSucursal", sucursalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 horas
    });

    return response;
  } catch (error) {
    console.error("Error al registrar sucursal:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

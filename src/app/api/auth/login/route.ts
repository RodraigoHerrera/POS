import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";



export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { correo, contraseña } = body;

    if (!correo || !contraseña) {
      return NextResponse.json(
        { message: "Correo y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const sucursal = await prisma.sucursal.findUnique({
      where: { correo },
    });

    if (!sucursal) {
      return NextResponse.json(
        { message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(contraseña, sucursal.contrase_a);
    if (!passwordMatch) {
      return NextResponse.json(
        { message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const token = jwt.sign(
        {
          sucursalId: sucursal.id.toString(), // 👈 Esto resuelve el error
          correo: sucursal.correo,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "1h" }
      );

    const response = NextResponse.json(
      { message: "Inicio de sesión exitoso" },
      { status: 200 }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60, // 1 hora
    });

    return response;
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// app/api/auth/login/route.ts - Versión actualizada
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

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

    // Reutilizamos tu lógica de validación
    const sucursal = await prisma.sucursales.findUnique({
      where: { correo },
    });

    if (!sucursal) {
      return NextResponse.json(
        { message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(contraseña, sucursal.contrasena);
    if (!passwordMatch) {
      return NextResponse.json(
        { message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // En lugar de crear JWT manualmente, NextAuth manejará la sesión
    return NextResponse.json(
      { 
        message: "Inicio de sesión exitoso",
        user: {
          id: sucursal.id,
          email: sucursal.correo,
          name: sucursal.nombre
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
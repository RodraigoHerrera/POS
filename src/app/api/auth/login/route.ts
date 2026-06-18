import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const correo: string | undefined = body?.correo;
    // Acepta 'contrasena' o 'contraseña' desde el body
    const contrasena: string | undefined = body?.contrasena ?? body?.["contraseña"];

    if (!correo || !contrasena) {
      return NextResponse.json(
        { message: "Correo y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const sucursal = await prisma.sucursales.findUnique({
      where: { correo },
    });

    if (!sucursal) {
      return NextResponse.json(
        { message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(contrasena, sucursal.contrasena);
    if (!passwordMatch) {
      return NextResponse.json(
        { message: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("Falta JWT_SECRET en variables de entorno");
      return NextResponse.json({ message: "Error de configuración" }, { status: 500 });
    }

    // 👉 Generar sucursalToken (vida más larga si quieres, p.ej. 8h)
    const sucursalToken = jwt.sign(
      {
        sucursalId: sucursal.id.toString(),
        correo: sucursal.correo,
      },
      secret,
      { expiresIn: "8h" }
    );

    // Respuesta con el token (opcional devolverlo en el body)
    const response = NextResponse.json(
      { message: "Inicio de sesión exitoso", sucursalToken },
      { status: 200 }
    );

    // Guardar cookie httpOnly con el token de sucursal
    response.cookies.set("tokenSucursal", sucursalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 horas
    });

    // Por seguridad, limpiar cualquier tokenEmpleado previo
    response.cookies.set("tokenEmpleado", "", {
      path: "/",
      maxAge: 0,
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

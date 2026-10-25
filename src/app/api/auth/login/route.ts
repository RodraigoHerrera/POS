import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  checkRateLimit,
  isLocked,
  recordFailure,
  clearRateLimit,
  rateLimitResponse,
  getClientIp,
  DUMMY_HASH,
} from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const ipCheck = checkRateLimit("login:ip:" + clientIp, 15, 60_000);
    if (!ipCheck.allowed) {
      return rateLimitResponse(
        ipCheck.retryAfterSeconds,
        `Demasiados intentos desde esta IP. Intenta de nuevo en ${ipCheck.retryAfterSeconds} segundos.`
      );
    }

    const body = await req.json();
    const correo: string | undefined = body?.correo;
    // Acepta 'contrasena' o 'contraseña' desde el body
    const contrasena: string | undefined = body?.contrasena ?? body?.["contraseña"];

    if (!correo || !contrasena) {
      return NextResponse.json(
        {
          message: "Correo y contraseña son obligatorios",
          error: "Correo y contraseña son obligatorios",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = correo.trim().toLowerCase();
    const emailKey = "login:email:" + normalizedEmail;

    const lockoutCheck = isLocked(emailKey, 5, 15 * 60 * 1000);
    if (lockoutCheck.locked) {
      const retryMinutes = Math.max(1, Math.ceil(lockoutCheck.retryAfterSeconds / 60));
      return rateLimitResponse(
        lockoutCheck.retryAfterSeconds,
        `Demasiados intentos fallidos para este correo. Intenta de nuevo en ${retryMinutes} minutos.`
      );
    }

    const sucursal = await prisma.sucursales.findUnique({
      where: { correo: normalizedEmail },
    });

    const hashToCompare = sucursal?.contrasena ?? DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(contrasena, hashToCompare);

    if (!sucursal || !passwordMatch) {
      recordFailure(emailKey, 15 * 60 * 1000, 5);
      return NextResponse.json(
        { message: "Credenciales inválidas", error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("Falta JWT_SECRET en variables de entorno");
      return NextResponse.json(
        { message: "Error interno del servidor", error: "Error interno del servidor" },
        { status: 500 }
      );
    }

    // Generar sucursalToken (12h)
    const sucursalToken = jwt.sign(
      {
        sucursalId: sucursal.id.toString(),
        correo: sucursal.correo,
      },
      secret,
      { expiresIn: "12h" }
    );

    clearRateLimit(emailKey);

    // Respuesta segura sin token en el cuerpo
    const response = NextResponse.json(
      { message: "Inicio de sesión exitoso" },
      { status: 200 }
    );

    // Guardar cookie httpOnly con el token de sucursal
    response.cookies.set("tokenSucursal", sucursalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 horas
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
      { message: "Error interno del servidor", error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

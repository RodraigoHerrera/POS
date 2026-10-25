import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireSucursal, esRespuestaError } from "@/lib/auth";
import { puedeIniciarSesionConPin } from "@/lib/empleadosKiosco";
import {
  checkRateLimit,
  isLocked,
  recordFailure,
  clearRateLimit,
  rateLimitResponse,
  getClientIp,
  DUMMY_HASH,
  clavePinEmpleado,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, pin } = body;

    if (!id || !pin) {
      return NextResponse.json(
        {
          error: "Faltan id o pin en el cuerpo de la petición",
          message: "Faltan id o pin en el cuerpo de la petición",
        },
        { status: 400 }
      );
    }

    // Verificación de sesión de sucursal
    const sucursalSesion = await requireSucursal();
    if (esRespuestaError(sucursalSesion)) {
      return NextResponse.json(
        {
          error: "No autorizado: la sucursal no ha iniciado sesión",
          message: "No autorizado: la sucursal no ha iniciado sesión",
        },
        { status: 401 }
      );
    }

    const sucursalId = sucursalSesion.sucursalId;
    if (!sucursalId) {
      return NextResponse.json(
        {
          error: "tokenSucursal no contiene sucursalId",
          message: "tokenSucursal no contiene sucursalId",
        },
        { status: 400 }
      );
    }

    // PIN Spray defense (máximo 30 peticiones por cada 5 minutos). Va por
    // sucursal + IP: sin proxy confiable la IP es la misma para todos, y así
    // una sucursal no puede agotar el límite de otra.
    const clientIp = getClientIp(request);
    const sprayCheck = checkRateLimit(`pin:suc:${sucursalId}:ip:${clientIp}`, 30, 5 * 60 * 1000);
    if (!sprayCheck.allowed) {
      return rateLimitResponse(
        sprayCheck.retryAfterSeconds,
        "Demasiados intentos de PIN desde esta terminal. Intenta de nuevo más tarde."
      );
    }

    // Pre-DB Employee Lockout Check (5 fallos en 15 minutos)
    const empleadoKey = clavePinEmpleado(String(sucursalId), String(id));
    const lockoutCheck = isLocked(empleadoKey, 5, 15 * 60 * 1000);
    if (lockoutCheck.locked) {
      return rateLimitResponse(
        lockoutCheck.retryAfterSeconds,
        "Demasiados intentos fallidos para este empleado. Intenta de nuevo en unos minutos."
      );
    }

    // Consulta en base de datos protegida
    let empleado = null;
    try {
      empleado = await prisma.empleados.findUnique({
        where: { id: BigInt(id) },
      });
    } catch {
      empleado = null;
    }

    const isTargetValid = !!empleado && empleado.sucursal_id.toString() === String(sucursalId);
    const hashToCompare = empleado && isTargetValid ? empleado.contrasena : DUMMY_HASH;
    const isValid = await bcrypt.compare(String(pin), hashToCompare);

    // Un empleado dado de baja tampoco entra aunque conserve su PIN, y recibe
    // la misma respuesta que un PIN incorrecto para no confirmar el PIN
    if (!empleado || !puedeIniciarSesionConPin(empleado, String(sucursalId), isValid)) {
      recordFailure(empleadoKey, 15 * 60 * 1000, 5);
      return NextResponse.json(
        { error: "PIN incorrecto", message: "PIN incorrecto" },
        { status: 401 }
      );
    }

    // Restablecer el contador de fallos tras inicio de sesión exitoso
    clearRateLimit(empleadoKey);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("❌ Faltante: JWT_SECRET no está definido en el entorno");
      return NextResponse.json(
        {
          error: "Error interno del servidor",
          message: "Error interno del servidor",
        },
        { status: 500 }
      );
    }

    // Emitir tokenEmpleado (8h)
    const tokenEmpleado = jwt.sign(
      {
        empleadoId: empleado.id.toString(),
        rol: empleado.rol,
        sucursalId: sucursalId.toString(),
      },
      secret,
      { expiresIn: "8h" }
    );

    const response = NextResponse.json({ rol: empleado.rol }, { status: 200 });

    response.cookies.set("tokenEmpleado", tokenEmpleado, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 horas
    });

    return response;
  } catch (error) {
    console.error("DEBUG: Error en el endpoint /usuarios/id:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        message: "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}

// /app/api/usuarios/id/route.ts
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, pin } = body;

    if (!id || !pin) {
      return NextResponse.json(
        { error: "Faltan id o pin en el cuerpo de la petición" },
        { status: 400 }
      );
    }

    // 👇 Next 14/15: cookies() es async en algunos entornos → hay que await
    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;

    if (!tokenSucursal) {
      console.log("🚫 No hay tokenSucursal. Debe iniciar sesión la sucursal primero.");
      return NextResponse.json(
        { error: "No autorizado: la sucursal no ha iniciado sesión" },
        { status: 401 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("❌ Faltante: JWT_SECRET no está definido en el entorno");
      return NextResponse.json(
        { error: "Error de configuración del servidor" },
        { status: 500 }
      );
    }

    // Verificar tokenSucursal para extraer sucursalId
    let sucursalPayload: jwt.JwtPayload | string;
    try {
      sucursalPayload = jwt.verify(tokenSucursal, secret);
    } catch (error) {
      console.error("❌ tokenSucursal inválido o expirado:", error);
      return NextResponse.json(
        { error: "Sesión de sucursal inválida o expirada" },
        { status: 401 }
      );
    }

    const sucursalId =
      typeof sucursalPayload === "string"
        ? undefined
        : (sucursalPayload as jwt.JwtPayload)?.sucursalId;

    if (!sucursalId) {
      return NextResponse.json(
        { error: "tokenSucursal no contiene sucursalId" },
        { status: 400 }
      );
    }

    // Convertir el id a BigInt
    const empleadoId = BigInt(id);
    const empleado = await prisma.empleados.findUnique({
      where: { id: empleadoId },
    });

    if (!empleado) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    // Validar que el empleado pertenezca a la sucursal activa
    if (empleado.sucursal_id.toString() !== String(sucursalId)) {
      console.log("🚫 Empleado no pertenece a la sucursal autenticada");
      return NextResponse.json(
        { error: "Empleado no pertenece a la sucursal autenticada" },
        { status: 403 }
      );
    }

    // Logs de depuración
    console.log("DEBUG: PIN recibido:", pin);
    console.log("DEBUG: Hash almacenado:", empleado.contrasena);

    // Comparar el PIN recibido con el hash almacenado
    const isValid = await bcrypt.compare(String(pin), empleado.contrasena);
    console.log("DEBUG: Resultado de bcrypt.compare:", isValid);

    if (!isValid) {
      return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
    }

    // Emitir tokenEmpleado (2h)
    const tokenEmpleado = jwt.sign(
      {
        empleadoId: empleado.id.toString(),
        rol: empleado.rol,
      },
      secret,
      { expiresIn: "2h" }
    );

    const response = NextResponse.json({ rol: empleado.rol }, { status: 200 });

    response.cookies.set("tokenEmpleado", tokenEmpleado, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 2, // 2 horas
    });

    console.log("✅ Login de empleado exitoso:", {
      empleadoId: empleado.id,
      rol: empleado.rol,
      sucursalId,
    });

    return response;
  } catch (error) {
    console.error("DEBUG: Error en el endpoint /usuarios/id:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

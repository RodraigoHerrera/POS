import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import jwt from "jsonwebtoken";

// Clave secreta para verificar los tokens
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { total, detalles } = body;

    // 1. Obtener las cookies
    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
    const tokenEmpleado = cookieStore.get("tokenEmpleado")?.value;

    // Validar existencia de tokens
    if (!tokenSucursal) {
      return NextResponse.json(
        { error: 'No se identificó la sucursal (Token faltante).' },
        { status: 401 }
      );
    }

    if (!tokenEmpleado) {
      return NextResponse.json(
        { error: 'No se identificó al empleado (Token faltante).' },
        { status: 401 }
      );
    }

    let sucursalId: string | undefined;
    let empleadoId: string | undefined;

    // 2. Verificar Token de SUCURSAL
    try {
      const { payload } = await jwtVerify(tokenSucursal, secret);
      sucursalId = (payload?.sucursalId || payload?.id) as string; 
    } catch (error) {
      console.error("Error verificando token sucursal:", error);
      return NextResponse.json({ error: 'Sesión de sucursal inválida.' }, { status: 403 });
    }

    // 3. Verificar Token de EMPLEADO
    try {
      const { payload } = await jwtVerify(tokenEmpleado, secret);
      empleadoId = (payload?.empleadoId || payload?.id || payload?.sub || payload?.userId) as string;
    } catch (error) {
      console.error("Error verificando token empleado:", error);
      return NextResponse.json({ error: 'Sesión de empleado inválida.' }, { status: 403 });
    }

    // 4. Validar IDs
    if (!sucursalId || !empleadoId) {
      return NextResponse.json(
        { error: 'Error al leer identificadores de sesión (IDs nulos).' },
        { status: 400 }
      );
    }

    // 5. Verificar si YA existe caja abierta
    const cajaAbierta = await prisma.caja.findFirst({
      where: {
        sucursal_id: BigInt(sucursalId),
        empleado_id: BigInt(empleadoId),
        estado: 'abierta',
      },
    });

    if (cajaAbierta) {
      return NextResponse.json(
        { error: 'Ya tienes una caja abierta en esta sucursal.' },
        { status: 409 }
      );
    }

    // 6. Crear el registro de la caja
    const nuevaCaja = await prisma.caja.create({
      data: {
        sucursal_id: BigInt(sucursalId),
        empleado_id: BigInt(empleadoId),
        fecha_apertura: new Date(),
        saldo_inicial: total,
        estado: 'abierta',
        observaciones: `Apertura con desglose: ${JSON.stringify(detalles)}`,
      },
    });

    const secret1 = process.env.JWT_SECRET;
    if (!secret1) {
      return NextResponse.json({ message: "Error de configuración" }, { status: 500 });
    }
    
    // Generar el token de caja
    const cajaToken = jwt.sign(
        {
          cajaId: nuevaCaja.id.toString(), // CORREGIDO: decía 'cajalId'
          sucursalId: sucursalId,
          empleadoId: empleadoId
        },
        secret1,
        { expiresIn: "8h" }
      );

    // --- CORRECCIÓN FINAL ---
    
    // A. Primero definimos la respuesta exitosa final
    const response = NextResponse.json(
      {
        success: true,
        message: 'Caja aperturada correctamente',
        cajaId: nuevaCaja.id.toString(),
      },
      { status: 201 }
    );

    // B. Seteamos la cookie EN esa respuesta
    response.cookies.set("tokenCaja", cajaToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 horas
    });

    // C. ELIMINÉ el bloque que borraba la cookie (maxAge: 0) que tenías aquí por error

    console.log("Token generado:", cajaToken);

    // D. Retornamos la respuesta configurada
    return response;

    
  } catch (error) {
    console.error('Error al aperturar caja:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
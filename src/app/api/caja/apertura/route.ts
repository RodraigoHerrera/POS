import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from "jsonwebtoken";
import { requireEmpleado, esRespuestaError } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { total, detalles } = body;

    const saldoInicial = Number(total);
    if (!Number.isFinite(saldoInicial) || saldoInicial < 0) {
      return NextResponse.json(
        { error: 'El saldo inicial debe ser un número mayor o igual a 0.' },
        { status: 400 }
      );
    }

    // 1. Validar Sesión y Rol (Cajero o Administrador)
    const sesion = await requireEmpleado(["Cajero", "Administrador"]);
    if (esRespuestaError(sesion)) return sesion;
    const { sucursalId, empleadoId } = sesion;

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

    // 6. Crear el registro de la caja, con verificación anti doble-apertura:
    // el findFirst de arriba no cubre dos requests simultáneos (doble click),
    // así que tras crear se re-consulta cuántas cajas abiertas hay para este
    // empleado; si esta no es la más antigua, perdió la carrera y se elimina.
    const nuevaCaja = await prisma.caja.create({
      data: {
        sucursal_id: BigInt(sucursalId),
        empleado_id: BigInt(empleadoId),
        fecha_apertura: new Date(),
        saldo_inicial: saldoInicial,
        estado: 'abierta',
        observaciones: `Apertura con desglose: ${JSON.stringify(detalles)}`,
      },
    });

    const abiertas = await prisma.caja.findMany({
      where: {
        sucursal_id: BigInt(sucursalId),
        empleado_id: BigInt(empleadoId),
        estado: 'abierta',
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (abiertas.length > 1 && abiertas[0].id !== nuevaCaja.id) {
      await prisma.caja.delete({ where: { id: nuevaCaja.id } });
      return NextResponse.json(
        { error: 'Ya tienes una caja abierta en esta sucursal.' },
        { status: 409 }
      );
    }

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
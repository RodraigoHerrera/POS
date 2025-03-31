// /app/api/usuarios/id/route.ts
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, pin } = body;

    if (!id || !pin) {
      return NextResponse.json({ error: 'Faltan id o pin en el cuerpo de la petición' }, { status: 400 });
    }

    // Convertir el id a BigInt
    const empleadoId = BigInt(id);
    const empleado = await prisma.empleado.findUnique({
      where: { id: empleadoId },
    });

    if (!empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Log de depuración: valores recibidos
    console.log("DEBUG: PIN recibido:", pin);
    console.log("DEBUG: Hash almacenado:", empleado.contraseña);

    // Comparar el PIN recibido con el hash de la contraseña almacenada
    const isValid = await bcrypt.compare(String(pin), empleado.contraseña);
    console.log("DEBUG: Resultado de bcrypt.compare:", isValid);

    if (!isValid) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
    }

    return NextResponse.json({ rol: empleado.rol });
  } catch (error) {
    console.error("DEBUG: Error en el endpoint:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

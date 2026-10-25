import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { errorResponse } from '@/lib/apiError';
import { serializeBigInt } from '@/lib/serialize';
import { requireEmpleado, esRespuestaError } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    // 1. Validar Sesión y rol
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const body = await req.json();
    const { nombre, nit, contacto, telefono, email } = body;

    // 2. Validaciones de Datos
    if (!nombre) {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio' }, { status: 400 });
    }

    // Opcional: Verificar si ya existe un proveedor con el mismo NIT
    if (nit) {
      const existente = await prisma.proveedor.findFirst({
        where: { nit: nit }
      });
      if (existente) {
        return NextResponse.json({ error: `Ya existe un proveedor con el NIT ${nit}` }, { status: 409 });
      }
    }

    // 3. Crear Registro en Base de Datos
    const nuevoProveedor = await prisma.proveedor.create({
      data: {
        nombre,
        nit,
        contacto,
        telefono,
        email
      }
    });

    return NextResponse.json({
      success: true,
      message: "Proveedor creado exitosamente",
      data: serializeBigInt(nuevoProveedor)
    }, { status: 201 });

  } catch (error: any) {
    return errorResponse(error, "Error al crear el proveedor");
  }
}
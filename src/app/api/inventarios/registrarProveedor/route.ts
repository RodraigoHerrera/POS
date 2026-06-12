import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, nit, contacto, telefono, email } = body;

    // 1. Validar Sesión (Seguridad básica)
    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;

    if (!tokenSucursal) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
      await jwtVerify(tokenSucursal, secret);
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 403 });
    }

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

    // 4. Serializar respuesta (Manejo de BigInt para JSON)
    const proveedorSerializado = JSON.parse(JSON.stringify(nuevoProveedor, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));

    return NextResponse.json({
      success: true,
      message: "Proveedor creado exitosamente",
      data: proveedorSerializado
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error al crear proveedor:", error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
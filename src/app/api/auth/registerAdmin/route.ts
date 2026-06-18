import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { serializeBigInt } from "@/lib/serialize";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function getSucursalIdFromToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    // En tu login firmamos sucursalId como string, no number
    return (payload as any)?.sucursalId as string | undefined;
  } catch (error) {
    return null;
  }
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, correo, celular, contraseña, usuario, rol } = body;

    const cookieStore = await cookies();
    const tokenSucursal = cookieStore.get("tokenSucursal")?.value;
    
    const sucursalIdStr = await getSucursalIdFromToken(tokenSucursal!);
    
    if (!sucursalIdStr) {
      return NextResponse.json({ message: "Token inválido" }, { status: 403 });
    }

    // Verificar si ya existe un administrador con el correo proporcionado
    const existingAdmin = await prisma.empleados.findUnique({
      where: { correo },
    });

    if (existingAdmin) {
      return NextResponse.json(
        { message: "Ya existe un administrador con ese correo" },
        { status: 409 }
      );
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(contraseña, 10);

    // Crear el nuevo administrador en la base de datos
    const nuevoAdmin = await prisma.empleados.create({
      data: {
        sucursal_id: BigInt(sucursalIdStr),
        rol,
        nombre,
        correo,
        celular,
        contrasena: hashedPassword,
        creado: new Date(),
        estado: "Activo", // Ajusta el valor según tu lógica de negocio
        usuario,
      },
    });

    return NextResponse.json(
      {
        message: "Administrador registrado con éxito",
        admin: serializeBigInt(nuevoAdmin),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error al registrar administrador:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
      
    );
  }
}

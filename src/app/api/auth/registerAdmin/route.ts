import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sucursal_id, nombre, correo, celular, contraseña, usuario, rol } = body;

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
        sucursal_id: BigInt(sucursal_id), // Cambia esto según tu lógica de negocio
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
        admin: {
          ...nuevoAdmin,
          // Con esto evitamos posibles problemas con campos bigint
          id: nuevoAdmin.id.toString(),
          sucursal_id: nuevoAdmin.sucursal_id.toString(),
          creado: nuevoAdmin.creado.toISOString(),
        },
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { serializeBigInt } from "@/lib/serialize";
import { obtenerSesionSucursal, obtenerSesionEmpleado } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { nombre, correo, celular, contraseña, usuario, rol } = body;

    if (!correo || !/^[a-zA-Z0-9._%+-]+@smash\.com$/i.test(correo)) {
      return NextResponse.json(
        { message: "El correo debe terminar en @smash.com" },
        { status: 400 }
      );
    }

    const sesionSucursal = await obtenerSesionSucursal();
    if (!sesionSucursal) {
      return NextResponse.json({ message: "Token inválido" }, { status: 403 });
    }
    const sucursalIdStr = sesionSucursal.sucursalId;

    // Este endpoint sirve para dos casos:
    //  1) Bootstrap: la sucursal recién se creó (signup/newadmin) y todavía
    //     no tiene NINGÚN empleado — se permite sin tokenEmpleado, pero se
    //     fuerza rol "Administrador" sin importar lo que mande el body.
    //  2) Gestión normal (/admin/usuarios): la sucursal ya tiene empleados,
    //     así que se exige una sesión de empleado con rol Administrador —
    //     de lo contrario, cualquiera con solo tokenSucursal podría crearse
    //     un admin nuevo o agregar empleados sin permiso.
    const totalEmpleados = await prisma.empleados.count({
      where: { sucursal_id: BigInt(sucursalIdStr) },
    });

    if (totalEmpleados === 0) {
      rol = "Administrador";
    } else {
      const sesionEmpleado = await obtenerSesionEmpleado();
      if (!sesionEmpleado || sesionEmpleado.rol !== "Administrador") {
        return NextResponse.json(
          { message: "Solo un administrador puede registrar nuevos empleados" },
          { status: 403 }
        );
      }
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

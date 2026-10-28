import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";
import { serializeBigInt } from "@/lib/serialize";
import { validarNuevaContrasena } from "@/lib/contrasenaEmpleado";
import { altaEmpleadoAtomica } from "@/lib/altaEmpleado";
import { obtenerSesionSucursal, requireEmpleado, esRespuestaError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, correo, celular, contraseña, usuario, rol } = body;

    if (!correo || !/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(correo)) {
      return NextResponse.json(
        { message: "El correo debe terminar en @gmail.com" },
        { status: 400 }
      );
    }

    const errorContrasena = validarNuevaContrasena(contraseña);
    if (errorContrasena) {
      return NextResponse.json({ message: errorContrasena }, { status: 400 });
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
    const sesionEmpleado = await requireEmpleado(["Administrador"]);
    const esAdministrador = !esRespuestaError(sesionEmpleado);

    // El hash va fuera de la transacción: bcrypt es lento y retendría el bloqueo
    const hashedPassword = await bcrypt.hash(contraseña, 10);
    const resultado = await altaEmpleadoAtomica(prisma, {
      sucursalId: BigInt(sucursalIdStr),
      esAdministrador,
      rol,
      datos: { nombre, correo, celular, usuario },
      contrasenaHash: hashedPassword,
    });

    if (resultado.error) {
      return NextResponse.json({ message: resultado.error.message }, { status: resultado.error.status });
    }
    const { nuevoAdmin } = resultado;

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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { validarNuevaContrasena } from "@/lib/contrasenaEmpleado";
import {
  dejaSinAdministradores,
  esCorreoGmail,
  esRolEmpleado,
  estadoEmpleadoValido,
} from "@/lib/usuariosAdmin";
import { esEmpleadoActivo } from "@/lib/empleadosKiosco";
import bcrypt from "bcrypt";

// PUT /api/usuarios  (id viene en el body)
// Permite cambiar datos, rol (Cajero <-> Administrador) o contraseña de un
// empleado — solo un Administrador de la MISMA sucursal puede hacerlo.
export async function PUT(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const body = await req.json().catch(() => ({} as any));

    if (body == null || typeof body !== "object") {
      return NextResponse.json({ message: "Cuerpo inválido" }, { status: 400 });
    }

    const rawId = body.id;
    if (rawId === undefined || rawId === null) {
      return NextResponse.json({ message: "Falta el id en el cuerpo" }, { status: 400 });
    }

    let empleadoId: bigint;
    try {
      empleadoId = BigInt(rawId);
    } catch {
      return NextResponse.json({ message: "id inválido" }, { status: 400 });
    }

    const dataToUpdate: any = {};
    if (typeof body.nombre === "string") dataToUpdate.nombre = body.nombre;
    if (typeof body.correo === "string") dataToUpdate.correo = body.correo;
    if (typeof body.celular === "string" || body.celular === null) dataToUpdate.celular = body.celular;
    if (body.estado !== undefined) {
      const estado = estadoEmpleadoValido(body.estado);
      if (!estado) {
        return NextResponse.json({ message: "Estado inválido" }, { status: 400 });
      }
      dataToUpdate.estado = estado;
    }
    if (body.rol !== undefined) {
      if (!esRolEmpleado(body.rol)) {
        return NextResponse.json({ message: "Rol inválido" }, { status: 400 });
      }
      dataToUpdate.rol = body.rol;
    }

    // Cambio de contraseña (PIN): opcional; si viene, se valida y se hashea
    if (body.contrasena !== undefined) {
      const errorContrasena = validarNuevaContrasena(body.contrasena);
      if (errorContrasena) {
        return NextResponse.json({ message: errorContrasena }, { status: 400 });
      }
      dataToUpdate.contrasena = await bcrypt.hash(body.contrasena, 10);
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ message: "No hay campos para actualizar" }, { status: 400 });
    }

    // Aseguramos que el empleado editado pertenezca a la misma sucursal del
    // administrador que hace la petición (evita que un admin de otra
    // sucursal edite empleados ajenos adivinando el id).
    const empleadoObjetivo = await prisma.empleados.findUnique({
      where: { id: empleadoId },
      select: { sucursal_id: true, rol: true, estado: true, correo: true },
    });

    if (!empleadoObjetivo || empleadoObjetivo.sucursal_id.toString() !== sesion.sucursalId) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });
    }

    // El formulario reenvía siempre el correo: la regla solo aplica si cambia,
    // para no bloquear la edición de empleados con correos anteriores a la regla
    if (dataToUpdate.correo !== undefined && dataToUpdate.correo !== empleadoObjetivo.correo && !esCorreoGmail(dataToUpdate.correo)) {
      return NextResponse.json({ message: "El correo debe terminar en @gmail.com" }, { status: 400 });
    }

    // Nunca dejar la sucursal sin un administrador activo (se bloquearía la gestión)
    if (dataToUpdate.rol !== undefined || dataToUpdate.estado !== undefined) {
      const administradores = await prisma.empleados.findMany({
        where: { sucursal_id: empleadoObjetivo.sucursal_id, rol: "Administrador", id: { not: empleadoId } },
        select: { estado: true },
      });
      const otrosActivos = administradores.filter((a) => esEmpleadoActivo(a.estado)).length;
      if (dejaSinAdministradores(empleadoObjetivo, dataToUpdate, otrosActivos)) {
        return NextResponse.json(
          { message: "La sucursal debe conservar al menos un administrador activo" },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.empleados.update({
      where: { id: empleadoId },
      data: dataToUpdate,
      select: {
        id: true,       // <- viene como BigInt
        nombre: true,
        correo: true,
        celular: true,
        estado: true,
        rol: true,
      },
    });

    return NextResponse.json(serializeBigInt(updated), { status: 200 });
  } catch (err: any) {
    return errorResponse(err, "Error al actualizar el usuario");
  }
}

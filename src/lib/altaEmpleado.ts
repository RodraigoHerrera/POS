import type { PrismaClient } from "@prisma/client";
import { decidirAltaEmpleado } from "./usuariosAdmin";

interface DatosAlta {
  nombre: string;
  correo: string;
  celular: string | null;
  usuario: string;
}

export interface ParametrosAlta {
  sucursalId: bigint;
  esAdministrador: boolean;
  rol: unknown;
  datos: DatosAlta;
  contrasenaHash: string;
}

/**
 * Contar y crear tienen que ser atómicos: con dos peticiones simultáneas sobre
 * una sucursal vacía, ambas verían 0 empleados y crearían un admin cada una sin
 * sesión. FOR UPDATE sobre la fila de la sucursal las serializa.
 */
export async function altaEmpleadoAtomica(db: Pick<PrismaClient, "$transaction">, p: ParametrosAlta) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sucursales WHERE id = ${p.sucursalId} FOR UPDATE`;

    const totalEmpleados = await tx.empleados.count({ where: { sucursal_id: p.sucursalId } });
    const decision = decidirAltaEmpleado({
      totalEmpleados,
      esAdministrador: p.esAdministrador,
      rol: p.rol,
    });
    if (decision.tipo === "prohibido") {
      return { nuevoAdmin: null, error: { message: "Solo un administrador puede registrar nuevos empleados", status: 403 } };
    }
    if (decision.tipo === "rol_invalido") {
      return { nuevoAdmin: null, error: { message: "Rol inválido", status: 400 } };
    }

    // Verificar si ya existe un empleado con el correo proporcionado
    const existente = await tx.empleados.findUnique({ where: { correo: p.datos.correo } });
    if (existente) {
      return { nuevoAdmin: null, error: { message: "Ya existe un administrador con ese correo", status: 409 } };
    }

    const nuevoAdmin = await tx.empleados.create({
      data: {
        sucursal_id: p.sucursalId,
        rol: decision.rol,
        nombre: p.datos.nombre,
        correo: p.datos.correo,
        celular: p.datos.celular,
        contrasena: p.contrasenaHash,
        creado: new Date(),
        estado: "Activo",
        usuario: p.datos.usuario,
      },
      select: {
        id: true,
        sucursal_id: true,
        rol: true,
        usuario: true,
        correo: true,
        nombre: true,
        celular: true,
        creado: true,
        estado: true,
      },
    });
    return { nuevoAdmin, error: null };
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/serialize";
import { errorResponse } from "@/lib/apiError";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";

// PUT /api/usuarios  (id viene en el body)
// Permite cambiar el rol de un empleado (Cajero <-> Administrador) — solo un
// Administrador de la MISMA sucursal puede hacerlo.
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
    if (typeof body.estado === "string") dataToUpdate.estado = body.estado;
    if (typeof body.rol === "string") dataToUpdate.rol = body.rol;

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ message: "No hay campos para actualizar" }, { status: 400 });
    }

    // Aseguramos que el empleado editado pertenezca a la misma sucursal del
    // administrador que hace la petición (evita que un admin de otra
    // sucursal edite empleados ajenos adivinando el id).
    const empleadoObjetivo = await prisma.empleados.findUnique({
      where: { id: empleadoId },
      select: { sucursal_id: true },
    });

    if (!empleadoObjetivo || empleadoObjetivo.sucursal_id.toString() !== sesion.sucursalId) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 });
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

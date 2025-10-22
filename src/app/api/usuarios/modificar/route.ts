import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// helper: convierte cualquier BigInt a string para JSON
function jsonSafe<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

// PUT /api/usuarios  (id viene en el body)
export async function PUT(req: Request) {
  try {
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

    // ✅ convierte BigInt a string antes de responder
    return NextResponse.json(jsonSafe(updated), { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/usuarios error:", err);
    return NextResponse.json(
      { message: "Error al actualizar el usuario" },
      { status: 500 }
    );
  }
}

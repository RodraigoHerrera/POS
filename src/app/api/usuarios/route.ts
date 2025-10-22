import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

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

export async function GET() {
  // ✅ Usa cookies() (async) y lee la cookie correcta: tokenSucursal
  const cookieStore = await cookies();
  const tokenSucursal = cookieStore.get("tokenSucursal")?.value;

  if (!tokenSucursal) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const sucursalIdStr = await getSucursalIdFromToken(tokenSucursal);

  if (!sucursalIdStr) {
    return NextResponse.json({ message: "Token inválido" }, { status: 403 });
  }

  try {
    // Prisma espera BigInt en sucursal_id
    const empleados = await prisma.empleados.findMany({
      where: { sucursal_id: BigInt(sucursalIdStr) },
      select: {
        id: true,
        nombre: true,
        rol: true,
        estado: true,
        correo: true,
        celular: true,
        creado: true,
      },
      orderBy: { nombre: "asc" },
    });

    // Normalizamos: id a string y foto por defecto
    const empleadosConFoto = empleados.map((e) => ({
      id: e.id.toString(),
      nombre: e.nombre,
      fotoUrl: "/default-user.jpg",
      rol: e.rol,
      estado: e.estado,
      correo: e.correo,
      celular: e.celular,
      creado: e.creado,
    }));

    return NextResponse.json(empleadosConFoto);
  } catch (error) {
    console.error("Error al obtener empleados:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}

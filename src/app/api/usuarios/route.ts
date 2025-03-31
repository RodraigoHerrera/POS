import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";

const prisma = new PrismaClient();
const secret = new TextEncoder().encode(process.env.JWT_SECRET);

async function getSucursalIdFromToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sucursalId as number;
  } catch (error) {
    return null;
  }
}

export async function GET(req: Request) {
  const token = req.headers.get("cookie")?.split("token=")[1]?.split(";")[0];

  if (!token) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  const sucursalId = await getSucursalIdFromToken(token);

  if (!sucursalId) {
    return NextResponse.json({ message: "Token inválido" }, { status: 403 });
  }

  try {
    const empleados = await prisma.empleado.findMany({
      where: { sucursal_id: sucursalId },
      select: {
        id: true,
        nombre: true,
      },
    });

    // Agregar imagen por defecto y convertir BigInt a string
    const empleadosConFoto = empleados.map((e) => ({
      id: e.id.toString(),
      nombre: e.nombre,
      fotoUrl: "/default-user.jpg",
    }));

    return NextResponse.json(empleadosConFoto);
  } catch (error) {
    console.error("Error al obtener empleados:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
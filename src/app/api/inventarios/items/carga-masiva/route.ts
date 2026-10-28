import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { serializeBigInt } from "@/lib/serialize";
import {
  parsearCSVItems,
  validarFilasItems,
  ejecutarCargaMasivaItems,
} from "@/lib/cargaMasivaItems";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    let textoCSV = "";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const archivo = formData.get("file") as File | null;

      if (!archivo) {
        return NextResponse.json(
          { message: "No se proporcionó ningún archivo CSV en el campo 'file'." },
          { status: 400 }
        );
      }

      const buffer = await archivo.arrayBuffer();
      const decoder = new TextDecoder("utf-8");
      textoCSV = decoder.decode(buffer);
    } else {
      textoCSV = await req.text();
    }

    if (!textoCSV || textoCSV.trim() === "") {
      return NextResponse.json(
        { message: "El contenido del archivo CSV está vacío." },
        { status: 400 }
      );
    }

    // 1. Parsear estructura y cabeceras
    const resultadoParse = parsearCSVItems(textoCSV);
    if (!resultadoParse.ok) {
      return NextResponse.json(
        { message: resultadoParse.error },
        { status: 400 }
      );
    }

    // 2. Validar tipos de datos y duplicados en el archivo
    const resultadoValidacion = validarFilasItems(resultadoParse.filas);

    // 3. Ejecutar Upsert en la base de datos
    const reporte = await ejecutarCargaMasivaItems(prisma, resultadoValidacion);

    return NextResponse.json({
      message: "Proceso de carga masiva finalizado.",
      reporte: serializeBigInt(reporte),
    });
  } catch (error: unknown) {
    console.error("Error en POST /api/inventarios/items/carga-masiva:", error);
    const mensaje = error instanceof Error ? error.message : "Error interno del servidor durante la carga masiva.";
    return NextResponse.json(
      { message: mensaje },
      { status: 500 }
    );
  }
}

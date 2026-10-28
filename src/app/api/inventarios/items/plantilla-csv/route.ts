import { NextResponse } from "next/server";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import { generarPlantillaCSV } from "@/lib/cargaMasivaItems";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sesion = await requireEmpleado(["Administrador"]);
    if (esRespuestaError(sesion)) return sesion;

    const csvContent = generarPlantillaCSV();

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="plantilla_items.csv"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Error generando plantilla CSV:", error);
    return NextResponse.json(
      { message: "Error interno al generar la plantilla CSV." },
      { status: 500 }
    );
  }
}

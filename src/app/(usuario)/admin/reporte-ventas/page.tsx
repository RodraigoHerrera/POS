import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import ReporteVentasClient from "./ReporteVentasClient";

export const metadata: Metadata = {
  title: "Reporte de Ventas | Smash POS",
  description: "Descarga reportes de ventas en CSV por usuario, caja, producto y ventas anuladas",
};

export default async function ReporteVentasPage() {
  const sesion = await requireEmpleado(["Administrador"]);
  if (esRespuestaError(sesion)) {
    redirect("/usuarios");
  }

  return <ReporteVentasClient />;
}

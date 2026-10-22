import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireEmpleado, esRespuestaError } from "@/lib/auth";
import VentasClient from "./VentasClient";

export const metadata: Metadata = {
  title: "Gestión de Ventas y Facturación | Smash POS",
  description: "Auditoría de ventas, comprobantes fiscales, costeo FEFO y anulación administrativa de comandas",
};

export default async function VentasPage() {
  const sesion = await requireEmpleado(["Administrador"]);
  if (esRespuestaError(sesion)) {
    redirect("/usuarios");
  }

  return <VentasClient />;
}

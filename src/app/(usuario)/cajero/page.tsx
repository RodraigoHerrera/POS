"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DenominacionesForm, { DetalleDenominacion } from "@/components/caja/DenominacionesForm";
import TopBarCajero from "@/components/caja/TopBarCajero";

export default function ArqueoCajaPage() {
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const save = async (total: number, detalle: DetalleDenominacion[]) => {
    try {
      setIsSaving(true);

      const response = await fetch("/api/caja/apertura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total, detalles: detalle }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al guardar");
      }

      router.push("/cajero/ventas");
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Ocurrió un error al abrir la caja");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900">
      <TopBarCajero variant="simple" titulo="Apertura de Caja" empleadoNombre="" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <DenominacionesForm
            title="Arqueo de Caja"
            subtitle="Registre el conteo físico de efectivo para la apertura."
            submitLabel="Confirmar Apertura"
            savingLabel="Aperturando..."
            isSaving={isSaving}
            onSubmit={save}
          />
        </div>
      </div>
    </div>
  );
}

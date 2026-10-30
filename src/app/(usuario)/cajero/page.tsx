"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DenominacionesForm, { DetalleDenominacion } from "@/components/caja/DenominacionesForm";
import TopBarCajero from "@/components/caja/TopBarCajero";
import { destinoTrasApertura } from "@/lib/aperturaCaja";

export default function ArqueoCajaPage() {
  const [isCheckingCaja, setIsCheckingCaja] = useState(true);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkCajaStatus() {
      try {
        const response = await fetch("/api/caja/resumen", {
          credentials: "include",
        });

        if (!isMounted) return;

        if (response.ok) {
          router.replace("/cajero/ventas");
          return;
        }

        if (response.status === 401 || response.status === 403) {
          router.replace("/usuarios");
          return;
        }

        if (response.status === 404) {
          setIsCheckingCaja(false);
          return;
        }

        const data = await response.json().catch(() => null);
        console.error("Error al verificar estado de caja:", data?.message || response.statusText);
        setCheckError(data?.message || "No se pudo verificar el estado de la caja");
        setIsCheckingCaja(false);
      } catch (error) {
        if (!isMounted) return;
        console.error("Error de conexión al verificar estado de caja:", error);
        setCheckError("Error de conexión al verificar el estado de la caja");
        setIsCheckingCaja(false);
      }
    }

    checkCajaStatus();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const save = async (total: number, detalle: DetalleDenominacion[]) => {
    try {
      setIsSaving(true);

      const response = await fetch("/api/caja/apertura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total, detalles: detalle }),
      });

      const data = await response.json();

      if (destinoTrasApertura(response.status) === "error") {
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

  if (isCheckingCaja) {
    return (
      <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900">
        <TopBarCajero variant="simple" titulo="Apertura de Caja" empleadoNombre="" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Verificando estado de caja...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900">
      <TopBarCajero variant="simple" titulo="Apertura de Caja" empleadoNombre="" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          {checkError && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
              {checkError}
            </div>
          )}
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

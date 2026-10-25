import type { Metadata } from "next";
import MrpPanel from "@/components/mrp/MrpPanel";

export const metadata: Metadata = {
  title: "Planificación MRP — Smash POS",
  description: "Pronóstico de demanda, MPS y explosión de materiales",
};

export default function MrpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          Planificación de producción y compras (MRP)
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Pronóstico de demanda, MPS y explosión de materiales
        </p>
      </div>
      <MrpPanel />
    </div>
  );
}

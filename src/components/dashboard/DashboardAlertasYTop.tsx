"use client";

import React from "react";
import { useRouter } from "next/navigation";
import StockAlertsCard from "@/components/inventario/StockAlertsCard";
import TopProductosCard from "@/components/ecommerce/TopProductosCard";

/**
 * Llena el hueco que quedaba debajo de las KPI cards del dashboard
 * (EcommerceMetrics) con las dos cosas que hoy no se ven en ningún lado del
 * panel principal: alertas de stock bajo y el top de productos del mes.
 * Componente cliente aparte porque necesita useRouter para "Reponer"/"Ver
 * todos" -> /admin/inventario.
 */
export default function DashboardAlertasYTop() {
  const router = useRouter();

  return (
    <div className="space-y-4 md:space-y-6">
      <StockAlertsCard
        onReponer={() => router.push("/admin/inventario")}
        onVerTodos={() => router.push("/admin/inventario")}
      />
      <TopProductosCard />
    </div>
  );
}

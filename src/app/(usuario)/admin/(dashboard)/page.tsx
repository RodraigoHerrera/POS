import type { Metadata } from "next";
import { EcommerceMetrics } from "@/components/ecommerce/EcommerceMetrics";
import React from "react";
import MonthlyTarget from "@/components/ecommerce/MonthlyTarget";
import StatisticsChart from "@/components/ecommerce/StatisticsChart";
import DashboardAlertasYTop from "@/components/dashboard/DashboardAlertasYTop";

export const metadata: Metadata = {
  title:
    "Smash POS",
  description: "This is Next.js Home for TailAdmin Dashboard Template",
};


export default function Ecommerce() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Antes había un hueco vacío debajo de las 2 KPI cards cortas
          (EcommerceMetrics) porque la celda no estiraba. Ahora se llena con
          alertas de stock + top productos, apiladas en la misma columna. */}
      <div className="col-span-12 space-y-4 xl:col-span-8 md:space-y-6">
        <EcommerceMetrics />
        <DashboardAlertasYTop />
      </div>

      <div className="col-span-12 xl:col-span-4">
        <MonthlyTarget />
      </div>

      <div className="col-span-12">
        <StatisticsChart />
      </div>
    </div>
  );
}

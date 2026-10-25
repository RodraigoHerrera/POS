import type { Metadata } from "next";
import React from "react";
import StatisticsChart from "@/components/ecommerce/StatisticsChart";
import DashboardPeriodo from "@/components/dashboard/DashboardPeriodo";

export const metadata: Metadata = {
  title:
    "Smash POS",
  description: "This is Next.js Home for TailAdmin Dashboard Template",
};


export default function Ecommerce() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      {/* Selector Mes/Semana y widgets que dependen del periodo (cliente). */}
      <DashboardPeriodo />

      <div className="col-span-12">
        <StatisticsChart />
      </div>
    </div>
  );
}

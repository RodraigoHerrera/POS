"use client";
import React, { useEffect, useState } from "react";
import Badge from "../ui/badge/Badge";
import { ArrowDownIcon, ArrowUpIcon, BoxIconLine, GroupIcon } from "@/icons";
import { Skeleton } from "../ui/skeleton/Skeleton";

export const EcommerceMetrics = () => {
  // Estado para el monto de ventas
  const [ventasMes, setVentasMes] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Efecto para obtener el total del mes actual al montar el componente
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/ventas/ventaMensual");
        const data = await response.json();

        if (data.success) {
          // Usamos 'formatted' que ya viene como "Bs 123.00"
          setVentasMes(data.formatted);
        } else {
          setVentasMes("Bs 0.00");
        }
      } catch (error) {
        console.error("Error cargando métricas:", error);
        setVentasMes("Error");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {/* <!-- Metric Item Start --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
        </div>

        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Clientes
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              3,782
            </h4>
          </div>
        </div>
      </div>
      {/* <!-- Metric Item End --> */}

      {/* <!-- Metric Item Start (VENTAS DINÁMICAS) --> */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
          <BoxIconLine className="text-gray-800 dark:text-white/90" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Ventas (Mes Actual)
            </span>
            {loading ? (
              <Skeleton className="mt-2 h-7 w-24" />
            ) : (
              <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {ventasMes}
              </h4>
            )}
          </div>

        </div>
      </div>
      {/* <!-- Metric Item End --> */}
    </div>
  );
};
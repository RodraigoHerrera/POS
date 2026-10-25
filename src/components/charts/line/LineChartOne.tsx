"use client";
import React, { useEffect, useState } from "react";

import { ApexOptions } from "apexcharts";

import dynamic from "next/dynamic";
// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface MovimientosMensuales {
  labels: string[];
  compras: number[];
  consumo: number[];
  mermas: number[];
  totalMermas: number;
  mermaPctSobreConsumo: number;
}

/**
 * Compras vs. Consumo (ventas) vs. Mermas, en Bs, últimos 6 meses — desde el
 * kardex real (movimientoInventario). Es el indicador de merma que faltaba
 * en el módulo de Inventario.
 */
export default function LineChartOne() {
  const [datos, setDatos] = useState<MovimientosMensuales | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const respuesta = await fetch("/api/inventarios/movimientosMensuales");
        if (!respuesta.ok) {
          throw new Error("Error al conectar con el servidor");
        }
        const json: MovimientosMensuales = await respuesta.json();
        setDatos(json);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los movimientos de inventario.");
      } finally {
        setCargando(false);
      }
    };
    obtenerDatos();
  }, []);

  if (cargando) return <div className="p-4 text-gray-500">Cargando gráfica...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!datos) return null;

  const options: ApexOptions = {
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#465FFF", "#9CB9FF", "#F04438"], // Compras, Consumo, Mermas (rojo de alerta)
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 310,
      type: "line",
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: "smooth",
      width: [2, 2, 3],
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.45,
        opacityTo: 0,
      },
    },
    markers: {
      size: 0,
      strokeColors: "#fff",
      strokeWidth: 2,
      hover: {
        size: 6,
      },
    },
    grid: {
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: (val: number) => `Bs ${val.toFixed(2)}`,
      },
    },
    xaxis: {
      type: "category",
      categories: datos.labels,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#6B7280"],
        },
        formatter: (val: number) => `Bs ${val.toFixed(0)}`,
      },
      title: {
        text: "",
        style: {
          fontSize: "0px",
        },
      },
    },
  };

  const series = [
    { name: "Compras", data: datos.compras },
    { name: "Consumo (ventas)", data: datos.consumo },
    { name: "Mermas", data: datos.mermas },
  ];

  return (
    <div className="max-w-full overflow-x-auto custom-scrollbar">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Últimos {datos.labels.length} meses, en bolivianos
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            datos.mermaPctSobreConsumo > 8
              ? "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400"
              : "bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"
          }`}
          title="Mermas como % del consumo (ventas) del periodo"
        >
          Merma: {datos.mermaPctSobreConsumo.toFixed(1)}% del consumo
        </span>
      </div>
      <div id="chartEight" className="min-w-[450px]">
        <ReactApexChart
          options={options}
          series={series}
          type="area"
          height={310}
        />
      </div>
    </div>
  );
}

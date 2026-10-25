"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { ArrowDownIcon, ArrowUpIcon, MoreDotIcon } from "@/icons";
import { useEffect, useState } from "react";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import Badge from "../ui/badge/Badge";
import { Skeleton } from "../ui/skeleton/Skeleton";

// Importación dinámica de ReactApexChart
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

// Meta de costo de producción (insumos) sobre ventas, en %.
// Estándar de la industria para fast-casual: 28-32%.
const META_COSTO_PCT = 30;

interface CostoProduccion {
  ventaTotal: number;
  costoTotal: number;
  margen: number;
  costoPct: number;
  costoPctMesAnterior: number;
}

export default function MonthlyTarget() {
  const router = useRouter();
  const [data, setData] = useState<CostoProduccion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCostoProduccion = async () => {
      try {
        const response = await fetch("/api/ventas/costoProduccion");
        const json = await response.json();
        if (json.success) {
          setData({
            ventaTotal: json.ventaTotal,
            costoTotal: json.costoTotal,
            margen: json.margen,
            costoPct: json.costoPct,
            costoPctMesAnterior: json.costoPctMesAnterior,
          });
        }
      } catch (error) {
        console.error("Error cargando costo de producción:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCostoProduccion();
  }, []);

  const costoPct = data?.costoPct ?? 0;
  const dentroDeMeta = costoPct <= META_COSTO_PCT;
  const gaugeColor = dentroDeMeta
    ? "#10B981" // verde: dentro de la meta
    : costoPct <= META_COSTO_PCT + 10
    ? "#F79009" // ámbar: levemente por encima
    : "#F04438"; // rojo: muy por encima de la meta

  const series = [Math.min(Math.round(costoPct), 100)];

  const options: ApexOptions = {
    colors: [gaugeColor],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "radialBar",
      height: 330,
      sparkline: {
        enabled: true,
      },
    },
    plotOptions: {
      radialBar: {
        startAngle: -85,
        endAngle: 85,
        hollow: {
          size: "80%",
        },
        track: {
          background: "#E2E8F0",
          strokeWidth: "100%",
          margin: 5,
        },
        dataLabels: {
          name: {
            show: true,
            color: "#64748B",
            fontSize: "14px",
            offsetY: 20,
          },
          value: {
            fontSize: "36px",
            fontWeight: "600",
            offsetY: -10,
            color: "#1D2939",
            formatter: function (val) {
              return val + "%";
            },
          },
        },
      },
    },
    fill: {
      type: "solid",
    },
    stroke: {
      lineCap: "round",
    },
    // Etiqueta central
    labels: ["Costo de Producción"],
  };

  const diffPct = data ? data.costoPct - data.costoPctMesAnterior : 0;
  const mejoro = diffPct <= 0; // bajar el % de costo es una mejora

  const [isOpen, setIsOpen] = useState(false);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  function irAReportes() {
    closeDropdown();
    router.push("/admin/reportes");
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-5 pt-5 bg-white shadow-default rounded-2xl pb-11 dark:bg-gray-900 sm:px-6 sm:pt-6">
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Costo de Producción
            </h3>
            <p className="mt-1 font-normal text-gray-500 text-theme-sm dark:text-gray-400">
              Costo de insumos sobre ventas · meta {META_COSTO_PCT}%
            </p>
          </div>
          <div className="relative inline-block">
            <button onClick={toggleDropdown} className="dropdown-toggle">
              <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
            </button>
            <Dropdown
              isOpen={isOpen}
              onClose={closeDropdown}
              className="w-40 p-2"
            >
              <DropdownItem
                tag="a"
                onItemClick={irAReportes}
                className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                Ver Reporte
              </DropdownItem>
            </Dropdown>
          </div>
        </div>

        <div className="relative">
          {loading ? (
            <Skeleton className="mx-auto h-[330px] w-full max-w-[330px] rounded-full" />
          ) : (
            <div className="max-h-[330px]">
              <ReactApexChart
                options={options}
                series={series}
                type="radialBar"
                height={330}
              />
            </div>
          )}

          {!loading && !dentroDeMeta && (
            <span className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded-full bg-error-50 px-3 py-1 text-xs font-medium text-error-600 dark:bg-error-500/15 dark:text-error-500">
              Por encima de la meta
            </span>
          )}
        </div>

        {loading ? (
          <Skeleton className="mx-auto mt-10 h-5 w-64" />
        ) : (
          <p className="mx-auto mt-10 flex w-full max-w-[380px] items-center justify-center gap-2 text-center text-sm text-gray-500 sm:text-base">
            El costo {mejoro ? "bajó" : "subió"} {Math.abs(diffPct).toFixed(1)} pts vs. mes anterior
            <Badge
              color={mejoro ? "success" : "error"}
              startIcon={mejoro ? <ArrowDownIcon /> : <ArrowUpIcon />}
            >
              {Math.abs(diffPct).toFixed(1)}%
            </Badge>
          </p>
        )}
      </div>

      {/* Footer con desglose financiero */}
      <div className="flex items-center justify-center gap-5 px-6 py-3.5 sm:gap-8 sm:py-5">
        {/* Costo de Insumos */}
        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Costo Insumos
          </p>
          {loading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className="text-center text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
              Bs {(data?.costoTotal ?? 0).toFixed(2)}
            </p>
          )}
        </div>

        <div className="w-px bg-gray-200 h-7 dark:bg-gray-800"></div>

        {/* Venta Total */}
        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Venta Total
          </p>
          {loading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p className="text-center text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
              Bs {(data?.ventaTotal ?? 0).toFixed(2)}
            </p>
          )}
        </div>

        <div className="w-px bg-gray-200 h-7 dark:bg-gray-800"></div>

        {/* Margen de Ganancia */}
        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Margen
          </p>
          {loading ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <p
              className={`text-center text-base font-semibold sm:text-lg ${
                (data?.margen ?? 0) >= 0
                  ? "text-success-600 dark:text-success-500"
                  : "text-error-600 dark:text-error-500"
              }`}
            >
              Bs {(data?.margen ?? 0).toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

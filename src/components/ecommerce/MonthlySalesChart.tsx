"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { MoreDotIcon } from "@/icons";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useState, useEffect } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import ChartSkeleton from "../ui/skeleton/ChartSkeleton";

// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function MonthlySalesChart() {
  // Estado para los datos de la gráfica
  const [series, setSeries] = useState([{ name: "Ventas", data: [] }]);
  // Estado para las etiquetas (Ene, Feb, Mar...)
  const [categories, setCategories] = useState<string[]>([]);
  // Estado para el total anual (opcional, para mostrarlo en el header si quisieras)
  const [totalAnual, setTotalAnual] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);

  // --- EFECTO DE CARGA DE DATOS ---
  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        const response = await fetch("/api/ventas/cantidad");
        const result = await response.json();

        if (result.success) {
          // Actualizamos la serie con los datos reales
          setSeries([
            {
              name: "Cant. de Ventas ",
              data: result.data, // Array del backend [10, 20, 5, ...]
            },
          ]);
          // Actualizamos las etiquetas (por si el backend las cambia dinámicamente)
          setCategories(result.labels);
          setTotalAnual(result.totalAnual);
        }
      } catch (error) {
        console.error("Error cargando gráfico de ventas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, []);

  // --- OPCIONES DE APEXCHARTS ---
  const options: ApexOptions = {
    colors: ["#FF1E00"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 180,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      // Usamos las categorías dinámicas o un fallback por defecto mientras carga
      categories: categories.length > 0 ? categories : [
        "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
      ],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    yaxis: {
      title: {
        text: undefined,
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      x: {
        show: false,
      },
      y: {
        formatter: (val: number) => `${val}`, // Formato de tooltip
      },
    },
  };

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Ventas Mensuales
          </h3>
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
              onItemClick={closeDropdown}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Ver Detalles
            </DropdownItem>
            <DropdownItem
              onItemClick={closeDropdown}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Exportar
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
          {loading ? (
            <ChartSkeleton height={180} />
          ) : (
            <ReactApexChart
              options={options}
              series={series}
              type="bar"
              height={180}
            />
          )}
        </div>
      </div>
    </div>
  );
}
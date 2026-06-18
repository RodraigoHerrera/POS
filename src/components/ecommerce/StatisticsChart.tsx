"use client";
import React, { useState, useEffect } from "react";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import ChartSkeleton from "../ui/skeleton/ChartSkeleton";

// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

// --- LÓGICA HOLT-WINTERS (Suavizamiento Exponencial Triple) ---
function calculateHoltWintersForecast(
  data: number[],
  forecastLength: number
): number[] {
  if (data.length < 2) return Array(forecastLength).fill(0);

  // Parámetros del modelo (Ajustables según la volatilidad de tus datos)
  const alpha = 0.3; // Nivel (Suavizado de la serie)
  const beta = 0.1;  // Tendencia (Suavizado de la pendiente)
  const gamma = 0.1; // Estacionalidad (Suavizado estacional)
  
  const seasonLength = 12; // Asumimos estacionalidad anual (12 meses)
  
  // Si no tenemos suficientes datos para una temporada completa, usamos proyección lineal simple (Holt)
  if (data.length < seasonLength) {
     // Fallback a Holt (Doble exponencial)
     let level = data[0];
     let trend = data[1] - data[0];
     
     // Entrenamiento
     for(let i = 1; i < data.length; i++) {
        const prevLevel = level;
        const val = data[i];
        level = alpha * val + (1 - alpha) * (prevLevel + trend);
        trend = beta * (level - prevLevel) + (1 - beta) * trend;
     }
     
     // Predicción
     const forecast = [];
     for(let h = 1; h <= forecastLength; h++) {
        forecast.push(Math.round(level + h * trend));
     }
     return forecast;
  }

  // Inicialización para Holt-Winters
  // 1. Estacionalidad inicial (Promedio simple de la diferencia con la media)
  const average = data.reduce((a, b) => a + b, 0) / data.length;
  const seasonals = data.map(val => val / average); // Modelo Multiplicativo simplificado para init

  // 2. Nivel y Tendencia inicial
  let level = data[0];
  let trend = (data[seasonLength - 1] - data[0]) / seasonLength; // Tendencia promedio del primer ciclo

  // Historial de estacionalidad suavizada
  const smoothSeasonals = [...seasonals]; 

  // Entrenamiento sobre los datos existentes
  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    const prevLevel = level;
    const seasonIdx = i % seasonLength;
    const currentSeasonal = smoothSeasonals[seasonIdx];

    // Actualizar Nivel (Desestacionalizando el dato actual)
    level = alpha * (val / currentSeasonal) + (1 - alpha) * (prevLevel + trend);
    
    // Actualizar Tendencia
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    
    // Actualizar Estacionalidad
    smoothSeasonals[seasonIdx] = gamma * (val / level) + (1 - gamma) * currentSeasonal;
  }

  // Generación del Pronóstico
  const forecast = [];
  for (let h = 1; h <= forecastLength; h++) {
    const seasonIdx = (data.length + h - 1) % seasonLength;
    const prediction = (level + h * trend) * smoothSeasonals[seasonIdx];
    forecast.push(Math.round(prediction));
  }

  return forecast;
}

export default function StatisticsChart() {
  // Estados para datos dinámicos
  // Series 0: Real, Series 1: Pronóstico
  const [series, setSeries] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Efecto para cargar datos del API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/ventas/cantidad");
        const data = await res.json();

        if (data.success) {
          const realData = data.data; // Array numérico [100, 120, ...]
          const realLabels = data.labels; // ["Ene", "Feb", ...]

          // Calcular Pronóstico para 3 meses
          const forecastData = calculateHoltWintersForecast(realData, 3);

          // Generar etiquetas para los meses futuros
          const lastMonthIndex = new Date().getMonth(); // Mes actual o último mes de datos
          const futureMonths = [];
          const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
          
          for (let i = 1; i <= 3; i++) {
             const nextIndex = (lastMonthIndex + i) % 12; // Calcular mes circularmente
             futureMonths.push(monthNames[nextIndex] + " (P)"); // (P) de Pronóstico
          }

          // PREPARAR SERIES PARA EL GRÁFICO
          // Serie 1 (Real): Datos reales + Nulos para el futuro
          const seriesReal = [...realData, ...Array(3).fill(null)];
          
          // Serie 2 (Pronóstico): Nulos para el pasado + Último dato real (para conectar la línea) + Pronóstico
          // "null" hace que la línea no se dibuje en esos puntos
          const lastRealValue = realData[realData.length - 1];
          const seriesForecast = [
             ...Array(realData.length - 1).fill(null), 
             lastRealValue, 
             ...forecastData
          ];

          setSeries([
            { name: "Ventas Reales", data: seriesReal },
            { name: "Pronóstico (Holt-Winters)", data: seriesForecast }
          ]);
          
          setCategories([...realLabels, ...futureMonths]);
        }
      } catch (error) {
        console.error("Error cargando estadísticas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const options: ApexOptions = {
    legend: {
      show: true, // Mostrar leyenda para distinguir real vs pronóstico
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#FF1E00", "#FF1E00"], // Mismo color base
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 310,
      type: "area",
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: "smooth",
      width: 3,
      // IMPORTANTE: Definir el estilo de línea. 
      // El índice 0 es sólido (Real), el índice 1 es punteado (Pronóstico)
      dashArray: [0, 5], 
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    markers: {
      size: 4,
      colors: ["#fff"],
      strokeColors: "#FFD700",
      strokeWidth: 2,
      hover: {
        size: 7,
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
        formatter: (val: number) => val !== null ? `${val} Und.` : '',
      },
    },
    xaxis: {
      type: "category",
      categories: categories,
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
      },
      title: {
        text: "",
      },
    },
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
        <div className="w-full">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Estadísticas Anuales + Proyección
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Ventas históricas y pronóstico (Holt-Winters) para los próximos 3 meses.
          </p>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[1000px] xl:min-w-full">
          {loading ? (
            <ChartSkeleton height={310} />
          ) : (
            <ReactApexChart
              options={options}
              series={series}
              type="area"
              height={310}
            />
          )}
        </div>
      </div>
    </div>
  );
}
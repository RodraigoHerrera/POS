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
  // Con 0 o 1 mes de historia real no hay con qué estimar una tendencia
  // (hace falta al menos un segundo punto para "data[1] - data[0]"). En vez
  // de devolver 0 — que en el gráfico se lee como "las ventas se van a
  // desplomar" — se proyecta plano el único valor conocido.
  if (data.length < 2) return Array(forecastLength).fill(data[0] ?? 0);

  // Parámetros del modelo (Ajustables según la volatilidad de tus datos)
  const alpha = 0.3; // Nivel (Suavizado de la serie)
  const beta = 0.1;  // Tendencia (Suavizado de la pendiente)
  const gamma = 0.1; // Estacionalidad (Suavizado estacional)
  
  const seasonLength = 12; // Asumimos estacionalidad anual (12 meses)

  // El modelo estacional multiplicativo divide por la estacionalidad de cada
  // mes (val / currentSeasonal); si algún mes del ciclo tiene 0 ventas —algo
  // garantizado en los meses futuros del año en curso, que llegan en 0 hasta
  // que ocurren— esa división es 0/0 y el NaN contamina el nivel y la
  // tendencia para siempre. Sin un ciclo completo de 12 meses con ventas
  // reales en todos, usamos Holt (sin estacionalidad), que no depende de
  // dividir por el valor del mes.
  const sinMesesEnCero = data.slice(0, seasonLength).every((v) => v > 0);

  // Si no tenemos un año completo y sin huecos, usamos proyección lineal simple (Holt)
  if (data.length < seasonLength || !sinMesesEnCero) {
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
          const realData = data.data; // Array numérico [100, 120, ...], 12 meses (Ene-Dic), futuros en 0
          const realLabels = data.labels; // ["Ene", "Feb", ...]

          // /api/ventas/cantidad siempre devuelve los 12 meses del año en
          // curso; los meses posteriores al actual vienen en 0 porque todavía
          // no ocurrieron, no porque hubo 0 ventas. Entrenar el pronóstico con
          // esos ceros "de futuro" como si fueran historia real rompe el
          // modelo (y le hace creer que la tendencia es de caída total). Solo
          // se usan los meses ya transcurridos.
          const mesActual = new Date().getMonth(); // 0 = enero
          const historiaTranscurrida = realData.slice(0, mesActual + 1);

          // Tampoco son demanda real los meses anteriores a la primera venta
          // registrada este año: esos ceros significan que la sucursal (o el
          // producto) todavía no operaba, no que hubo ventas nulas. Igual que
          // en el pronóstico del MRP, arrastrarlos sesga el nivel/tendencia
          // hacia abajo — se entrena solo desde el primer mes con ventas.
          const primerMesConVentas = historiaTranscurrida.findIndex((v: number) => v > 0);
          const historiaReal = primerMesConVentas >= 0
            ? historiaTranscurrida.slice(primerMesConVentas)
            : historiaTranscurrida;

          // Calcular Pronóstico para 3 meses
          const forecastData = calculateHoltWintersForecast(historiaReal, 3);

          // Generar etiquetas para los meses futuros
          const lastMonthIndex = mesActual; // Mes actual o último mes de datos
          const futureMonths = [];
          const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

          for (let i = 1; i <= 3; i++) {
             const nextIndex = (lastMonthIndex + i) % 12; // Calcular mes circularmente
             futureMonths.push(monthNames[nextIndex] + " (P)"); // (P) de Pronóstico
          }

          // PREPARAR SERIES PARA EL GRÁFICO
          // Solo se grafican los meses ya transcurridos (Ene..mesActual): los
          // meses futuros del año en curso vienen en 0 desde la API porque
          // todavía no ocurrieron, no porque las ventas cayeron a cero. Antes
          // se incluían los 12 meses completos y eso dibujaba una caída a
          // cero falsa después del mes actual.
          const realLabelsTranscurridos = realLabels.slice(0, mesActual + 1);

          // Serie 1 (Real): solo meses transcurridos + nulos para el horizonte de pronóstico
          const seriesReal = [...historiaTranscurrida, ...Array(3).fill(null)];

          // Serie 2 (Pronóstico): nulos para el pasado + último dato real (para
          // conectar la línea) + pronóstico. El punto de conexión es el ÚLTIMO
          // ÍNDICE de "historiaTranscurrida" (el mes actual), que por construcción
          // es el slot inmediatamente anterior al pronóstico — antes se usaba
          // "realData.length - 1" (siempre diciembre, sin importar el mes real),
          // lo que dejaba el punto de conexión en la posición equivocada del eje X.
          const lastRealValue = historiaTranscurrida[historiaTranscurrida.length - 1];
          const seriesForecast = [
             ...Array(historiaTranscurrida.length - 1).fill(null),
             lastRealValue,
             ...forecastData
          ];

          setSeries([
            { name: "Ventas Reales", data: seriesReal },
            { name: "Pronóstico (Holt-Winters)", data: seriesForecast }
          ]);

          setCategories([...realLabelsTranscurridos, ...futureMonths]);
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
    // Colores distintos por serie (antes ambas usaban "#FF1E00" y solo se
    // diferenciaban por el trazo punteado) para que la diferencia entre
    // ventas reales y pronóstico se note de un vistazo, no solo de cerca.
    colors: ["#FF1E00", "#F59E0B"], // Rojo = Ventas Reales, Ámbar = Pronóstico
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
      width: [3, 3],
      // El índice 0 es sólido (Real), el índice 1 es punteado (Pronóstico)
      dashArray: [0, 6],
    },
    fill: {
      type: "gradient",
      gradient: {
        // Relleno más tenue en el pronóstico para reforzar que es una
        // estimación, no un dato confirmado.
        opacityFrom: [0.55, 0.25],
        opacityTo: [0, 0],
      },
    },
    markers: {
      size: 4,
      colors: ["#fff", "#fff"],
      strokeColors: ["#FF1E00", "#F59E0B"],
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
        <div className="min-w-[700px] xl:min-w-full">
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
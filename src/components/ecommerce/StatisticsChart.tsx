"use client";
import React, { useState, useEffect, useMemo } from "react";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import ChartSkeleton from "../ui/skeleton/ChartSkeleton";
import {
  calculateSalesForecast,
  ForecastResult,
} from "@/lib/sales/forecast";
import { MonthlySalesBucket } from "@/app/api/ventas/cantidad/route";
import {
  AlertCircle,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";

// Dynamically import the ReactApexChart component for SSR safety
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export interface RawSalesPayload {
  data: number[];
  labels: string[];
  months: MonthlySalesBucket[];
}

export interface BacktestMetrics {
  evalLength: number;
  evalSpan: string;
  realUnits: number;
  forecastUnits: number;
  delta: number;
  absErrorPct: number;
  accuracyPct: number;
  isPartial: boolean;
}

export interface CutoffBoundaries {
  positiveIndices: number[];
  canTimeTravel: boolean;
  kMin: number;
}

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/**
 * Calculates cutoff boundaries ensuring at least 2 training observations for forecasting.
 */
export function calculateCutoffBoundaries(data: number[]): CutoffBoundaries {
  const n = data.length;
  const positiveIndices = data
    .map((v, i) => (v > 0 ? i : -1))
    .filter((i) => i !== -1);
  const canTimeTravel = positiveIndices.length >= 2;
  const kMin = canTimeTravel
    ? Math.max(1, positiveIndices[0] + 1)
    : Math.max(0, n - 1);

  return { positiveIndices, canTimeTravel, kMin };
}

/**
 * Generates forward timeline categories when projected horizon exceeds known history.
 */
export function generateCategories(
  labels: string[],
  months: MonthlySalesBucket[] | undefined,
  effectiveCutoff: number,
  horizon: number
): { categories: string[]; totalLength: number } {
  const n = labels.length;
  const totalLength = Math.max(n, effectiveCutoff + horizon + 1);
  const categories = [...labels];

  const futureCount = totalLength - n;
  if (futureCount > 0) {
    const lastBucket = months && months.length > 0 ? months[n - 1] : undefined;
    const lastYear =
      typeof lastBucket?.year === "number"
        ? lastBucket.year
        : new Date().getFullYear();
    const lastMonth =
      typeof lastBucket?.month === "number"
        ? lastBucket.month
        : new Date().getMonth() + 1;

    for (let p = 1; p <= futureCount; p++) {
      const totalMonth = lastMonth - 1 + p;
      const m = (totalMonth % 12) + 1;
      const y = lastYear + Math.floor(totalMonth / 12);
      const shortYr = String(y).slice(-2);
      categories.push(`${MONTH_NAMES[m - 1]} ${shortYr} (P)`);
    }
  }

  return { categories, totalLength };
}

/**
 * Builds real and forecasted series with continuity anchor stitch at index K.
 */
export function buildChartSeries(
  rawData: number[],
  forecast: number[],
  effectiveCutoff: number,
  horizon: number,
  totalLength: number,
  isPresent: boolean
): ApexAxisChartSeries {
  const seriesReal: (number | null)[] = [...rawData];
  while (seriesReal.length < totalLength) {
    seriesReal.push(null);
  }

  const seriesForecast: (number | null)[] = Array(effectiveCutoff).fill(null);
  // Anchor stitch: joins real curve seamlessly
  seriesForecast.push(rawData[effectiveCutoff] ?? 0);
  for (let i = 0; i < horizon; i++) {
    seriesForecast.push(forecast[i] ?? 0);
  }
  while (seriesForecast.length < totalLength) {
    seriesForecast.push(null);
  }

  return [
    { name: "Ventas Reales", data: seriesReal },
    {
      name: isPresent ? "Pronóstico (Holt-Winters)" : "Pronóstico Simulado",
      data: seriesForecast,
    },
  ];
}

/**
 * Calculates backtesting accuracy metrics between historical real sales and simulation.
 */
export function calculateBacktestMetrics(
  rawData: RawSalesPayload,
  effectiveCutoff: number,
  horizon: number,
  forecast: number[]
): BacktestMetrics | null {
  const n = rawData.data.length;
  const K = effectiveCutoff;
  const H = horizon;

  // Evaluation only exists for past cutoffs
  if (K >= n - 1) {
    return null;
  }

  const mEval = Math.max(0, Math.min(n - 1, K + H) - K);
  if (mEval <= 0) {
    return null;
  }

  let realUnits = 0;
  let forecastUnits = 0;
  for (let j = 1; j <= mEval; j++) {
    realUnits += rawData.data[K + j] ?? 0;
    forecastUnits += forecast[j - 1] ?? 0;
  }

  const delta = forecastUnits - realUnits;

  let absErrorPct = 0;
  let accuracyPct = 100;
  if (realUnits > 0) {
    absErrorPct = (Math.abs(delta) / realUnits) * 100;
    accuracyPct = Math.max(0, 100 - absErrorPct);
  } else if (forecastUnits > 0) {
    absErrorPct = 100;
    accuracyPct = 0;
  } else {
    absErrorPct = 0;
    accuracyPct = 100;
  }

  const startLabel = rawData.labels[K + 1] || "";
  const endLabel = rawData.labels[K + mEval] || "";
  const evalSpan =
    mEval === 1 ? startLabel : `${startLabel} - ${endLabel}`;

  return {
    evalLength: mEval,
    evalSpan,
    realUnits,
    forecastUnits,
    delta,
    absErrorPct,
    accuracyPct,
    isPartial: mEval < H,
  };
}

export default function StatisticsChart() {
  const [rawData, setRawData] = useState<RawSalesPayload | null>(null);
  const [cutoffIndex, setCutoffIndex] = useState<number | null>(null);
  const [horizon, setHorizon] = useState<number>(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/ventas/cantidad", {
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error(`Error ${res.status}: Fallo al consultar el servidor`);
        }

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || "Respuesta no exitosa del servidor");
        }

        const realData: number[] = Array.isArray(data.data) ? data.data : [];
        const realLabels: string[] = Array.isArray(data.labels) ? data.labels : [];
        const months: MonthlySalesBucket[] = Array.isArray(data.months) ? data.months : [];

        setRawData({
          data: realData,
          labels: realLabels,
          months,
        });
        // Default cutoffIndex back to present on data fetch
        setCutoffIndex(null);
      } catch (err: any) {
        if (err.name === "AbortError") {
          return;
        }
        console.error("Error cargando estadísticas de ventas:", err);
        setError(err?.message || "No se pudieron cargar las estadísticas de ventas");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [retryTrigger]);

  const n = rawData ? rawData.data.length : 0;

  const { positiveIndices, canTimeTravel, kMin } = useMemo(() => {
    if (!rawData) {
      return { positiveIndices: [], canTimeTravel: false, kMin: 0 };
    }
    return calculateCutoffBoundaries(rawData.data);
  }, [rawData]);

  const effectiveCutoff = useMemo(() => {
    if (!rawData || n === 0) return 0;
    if (cutoffIndex === null) return n - 1;
    return Math.max(kMin, Math.min(n - 1, cutoffIndex));
  }, [rawData, n, cutoffIndex, kMin]);

  const isPresent = n > 0 && effectiveCutoff === n - 1;
  const currentLabel = rawData?.labels[effectiveCutoff] ?? "";
  const monthsAgo = n > 0 ? (n - 1) - effectiveCutoff : 0;

  // Training slice for the forecasting engine
  const trainSlice = useMemo(() => {
    if (!rawData || n === 0) return [];
    return rawData.data.slice(0, effectiveCutoff + 1);
  }, [rawData, n, effectiveCutoff]);

  // Pure reactive forecast computation
  const forecastResult: ForecastResult | null = useMemo(() => {
    if (trainSlice.length === 0) return null;
    return calculateSalesForecast(trainSlice, horizon);
  }, [trainSlice, horizon]);

  // Timeline categories & series alignment
  const { categories, totalLength } = useMemo(() => {
    if (!rawData || n === 0) {
      return { categories: [], totalLength: 0 };
    }
    return generateCategories(rawData.labels, rawData.months, effectiveCutoff, horizon);
  }, [rawData, n, effectiveCutoff, horizon]);

  const series: ApexAxisChartSeries = useMemo(() => {
    if (!rawData || n === 0 || !forecastResult) {
      return [];
    }
    return buildChartSeries(
      rawData.data,
      forecastResult.forecast,
      effectiveCutoff,
      horizon,
      totalLength,
      isPresent
    );
  }, [rawData, n, forecastResult, effectiveCutoff, horizon, totalLength, isPresent]);

  // Backtesting accuracy computation
  const backtestMetrics: BacktestMetrics | null = useMemo(() => {
    if (!rawData || !canTimeTravel || !forecastResult) {
      return null;
    }
    return calculateBacktestMetrics(
      rawData,
      effectiveCutoff,
      horizon,
      forecastResult.forecast
    );
  }, [rawData, canTimeTravel, forecastResult, effectiveCutoff, horizon]);

  // Model & Confidence tier badges
  const methodLabel = useMemo(() => {
    if (!forecastResult) return "Holt-Winters";
    switch (forecastResult.method) {
      case "holt_winters_multiplicative":
        return "Holt-Winters";
      case "holt_linear":
        return "Holt Lineal";
      case "flat_naive":
        return "Punto Fijo";
      case "zero_fill":
        return "Sin Datos";
      default:
        return "Holt-Winters";
    }
  }, [forecastResult]);

  const confidenceLabel = useMemo(() => {
    if (!forecastResult) return "Alta";
    switch (forecastResult.confidence) {
      case "high":
        return "Alta";
      case "medium":
        return "Media";
      case "low":
        return "Baja";
      default:
        return "Alta";
    }
  }, [forecastResult]);

  const confidenceBadgeStyle = useMemo(() => {
    if (!forecastResult) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50";
    }
    switch (forecastResult.confidence) {
      case "high":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50";
      case "low":
      default:
        return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
    }
  }, [forecastResult]);

  const options: ApexOptions = useMemo(
    () => ({
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "left",
      },
      colors: ["#E03E26", "#FFA41B"],
      chart: {
        fontFamily: "Outfit, sans-serif",
        height: 310,
        type: "area",
        toolbar: {
          show: false,
        },
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 400,
          dynamicAnimation: {
            enabled: true,
            speed: 250,
          },
        },
      },
      stroke: {
        curve: "smooth",
        width: [3, 3],
        dashArray: [0, 6],
      },
      fill: {
        type: "gradient",
        gradient: {
          opacityFrom: [0.55, 0.25],
          opacityTo: [0, 0],
        },
      },
      markers: {
        size: 4,
        colors: ["#fff", "#fff"],
        strokeColors: ["#E03E26", "#FFA41B"],
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
        shared: true,
        intersect: false,
        y: {
          formatter: (val: number | null) =>
            val !== null && val !== undefined ? `${val.toLocaleString()} Und.` : "",
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
      annotations:
        categories.length > 0 && effectiveCutoff < categories.length
          ? {
              xaxis: [
                {
                  x: categories[effectiveCutoff],
                  strokeDashArray: 4,
                  borderColor: "#FFA41B",
                  borderWidth: 1.5,
                  label: {
                    text: isPresent ? "Presente" : "Corte Simulado",
                    style: {
                      color: "#fff",
                      background: "#FFA41B",
                      fontSize: "10px",
                      fontWeight: 600,
                    },
                  },
                },
              ],
            }
          : undefined,
    }),
    [categories, effectiveCutoff, isPresent]
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      {/* Header with Title, Contextual Subtitle, Badges & Horizon Pills */}
      <div className="flex flex-col gap-4 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Estadísticas Anuales + Proyección
            </h3>
            {forecastResult && !loading && !error && (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-brand-50 text-brand-600 border border-brand-200/80 dark:bg-brand-950/40 dark:text-brand-400 dark:border-brand-800/60">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {methodLabel}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${confidenceBadgeStyle}`}
                >
                  Confianza {confidenceLabel}
                </span>
              </div>
            )}
          </div>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            {isPresent
              ? `Ventas históricas (12 meses móviles) y pronóstico para los próximos ${horizon} meses.`
              : `Simulación de pronóstico anclada en ${currentLabel} con horizonte de ${horizon} ${horizon === 1 ? "mes" : "meses"}.`}
          </p>
        </div>

        {/* Horizon Selector Pills (1M, 2M, 3M, 6M) */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl border border-gray-200/80 dark:border-gray-700/60">
            {[1, 2, 3, 6].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                disabled={loading || !!error}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  horizon === h
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {h}M
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive Control Bar */}
      {!loading && !error && rawData && n > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 mb-4 rounded-xl bg-gray-50/80 border border-gray-200/70 dark:bg-gray-900/40 dark:border-gray-800/80">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Stepper Decrement */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="Retroceder mes de corte"
                disabled={!canTimeTravel || effectiveCutoff <= kMin}
                onClick={() => setCutoffIndex(Math.max(kMin, effectiveCutoff - 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750 transition-colors shadow-xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Scrub Range Slider */}
              <input
                type="range"
                min={kMin}
                max={n - 1}
                step={1}
                value={effectiveCutoff}
                onChange={(e) => setCutoffIndex(Number(e.target.value))}
                disabled={!canTimeTravel}
                className="w-32 sm:w-52 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-500 dark:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              />

              {/* Stepper Increment */}
              <button
                type="button"
                title="Avanzar mes de corte"
                disabled={!canTimeTravel || effectiveCutoff >= n - 1}
                onClick={() => setCutoffIndex(Math.min(n - 1, effectiveCutoff + 1))}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750 transition-colors shadow-xs cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Anchor Badge Chip */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
                isPresent
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50"
                  : "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isPresent ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span>
                {isPresent
                  ? `Presente (${currentLabel})`
                  : `Ancla: ${currentLabel} (-${monthsAgo} ${monthsAgo === 1 ? "mes" : "meses"})`}
              </span>
            </div>
          </div>

          {/* Reset Button (active when past cutoff or custom horizon) */}
          {(!isPresent || horizon !== 3) && (
            <button
              type="button"
              onClick={() => {
                setCutoffIndex(null);
                setHorizon(3);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-750 transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              <span>Restablecer al presente</span>
            </button>
          )}
        </div>
      )}

      {/* Backtesting Accuracy Card (Active during simulated past cutoffs) */}
      {!loading && !error && backtestMetrics && backtestMetrics.evalLength > 0 && !isPresent && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 mb-4 rounded-xl bg-amber-50/60 border border-amber-200/70 dark:bg-amber-950/20 dark:border-amber-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Evaluando {backtestMetrics.evalLength}{" "}
                  {backtestMetrics.evalLength === 1 ? "mes" : "meses"} ({backtestMetrics.evalSpan})
                </span>
                {backtestMetrics.isPartial && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-medium">
                    Parcial
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Real:{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {backtestMetrics.realUnits.toLocaleString()} Und.
                </span>{" "}
                | Simulado:{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {backtestMetrics.forecastUnits.toLocaleString()} Und.
                </span>{" "}
                <span
                  className={
                    backtestMetrics.delta >= 0
                      ? "text-brand-600 dark:text-brand-400 font-medium"
                      : "text-amber-600 dark:text-amber-400 font-medium"
                  }
                >
                  ({backtestMetrics.delta >= 0 ? "+" : ""}
                  {backtestMetrics.delta.toLocaleString()} Und.)
                </span>
              </p>
            </div>
          </div>

          {/* Accuracy Score Tag */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold border ${
                backtestMetrics.accuracyPct >= 85
                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                  : backtestMetrics.accuracyPct >= 60
                  ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60"
                  : "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
              }`}
            >
              {backtestMetrics.accuracyPct.toFixed(1)}% Precisión
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas / Skeletons / Error Fallbacks */}
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[700px] xl:min-w-full">
          {error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
              <div className="p-3 mb-3 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90 mb-1">
                Error al cargar estadísticas de ventas
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-md">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setRetryTrigger((prev) => prev + 1)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors shadow-theme-xs cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Reintentar
              </button>
            </div>
          ) : loading ? (
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

/**
 * Sales Forecasting Engine (Holt-Winters & Holt Linear Smoothing)
 *
 * Provides pure, deterministic, side-effect-free time series forecasting
 * for retail demand planning with non-negative clamping and mathematical guards.
 */

export type ForecastMethod =
  | "holt_winters_multiplicative"
  | "holt_linear"
  | "flat_naive"
  | "zero_fill";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ForecastOptions {
  alpha?: number;        // Level smoothing constant [0, 1], default: 0.3
  beta?: number;         // Trend smoothing constant [0, 1], default: 0.1
  gamma?: number;        // Seasonal smoothing constant [0, 1], default: 0.1
  seasonLength?: number; // Seasonality cycle length in periods, default: 12
  horizon?: number;      // Number of future periods to predict, default: 3
}

export interface ForecastResult {
  forecast: number[];    // Clamped non-negative integers of length 'horizon'
  method: ForecastMethod;
  confidence: ConfidenceLevel;
  params: {
    alpha: number;
    beta: number;
    gamma: number;
    seasonLength: number;
    historyLength: number;
  };
  [Symbol.iterator](): IterableIterator<number>;
}

export const EPSILON = 1e-4;

/**
 * Safe division guarded against division by zero and non-finite outputs.
 */
export function safeDiv(numerator: number, denominator: number, fallback = 1.0): number {
  if (Math.abs(denominator) < EPSILON) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/**
 * Non-negative clamping guard for retail sales quantities.
 */
export function clampNonNegative(val: number): number {
  if (!Number.isFinite(val) || isNaN(val)) {
    return 0;
  }
  return Math.max(0, val);
}

/**
 * Helper to construct a ForecastResult with iterable support.
 */
function createForecastResult(
  forecast: number[],
  method: ForecastMethod,
  confidence: ConfidenceLevel,
  params: {
    alpha: number;
    beta: number;
    gamma: number;
    seasonLength: number;
    historyLength: number;
  }
): ForecastResult {
  return {
    forecast,
    method,
    confidence,
    params,
    [Symbol.iterator]() {
      return forecast[Symbol.iterator]();
    },
  };
}

/**
 * Calculates a multi-step future sales forecast using Holt-Winters Multiplicative
 * triple smoothing with automatic fallbacks to Holt Linear and Naive Flat models.
 *
 * @param data Historical sales observations in chronological order.
 * @param horizonOrOptions Number of future periods to predict or configuration options.
 * @param maybeOptions Configuration options if horizon was passed as second argument.
 */
export function calculateSalesForecast(
  data: number[],
  horizonOrOptions?: number | ForecastOptions,
  maybeOptions?: ForecastOptions
): ForecastResult {
  // Normalize arguments
  let horizon = 3;
  let options: ForecastOptions = {};

  if (typeof horizonOrOptions === "number") {
    horizon = horizonOrOptions > 0 ? Math.floor(horizonOrOptions) : 3;
    options = maybeOptions ?? {};
  } else if (typeof horizonOrOptions === "object" && horizonOrOptions !== null) {
    options = horizonOrOptions;
    if (typeof options.horizon === "number" && options.horizon > 0) {
      horizon = Math.floor(options.horizon);
    }
  }

  const alpha = typeof options.alpha === "number" && options.alpha >= 0 && options.alpha <= 1 ? options.alpha : 0.3;
  const beta = typeof options.beta === "number" && options.beta >= 0 && options.beta <= 1 ? options.beta : 0.1;
  const gamma = typeof options.gamma === "number" && options.gamma >= 0 && options.gamma <= 1 ? options.gamma : 0.1;
  const seasonLength = typeof options.seasonLength === "number" && options.seasonLength > 0 ? Math.floor(options.seasonLength) : 12;

  // Sanitize input values: ensure finite non-negative numbers
  const sanitizedInput = (data || []).map((v) => clampNonNegative(v));

  // Strip leading zeros (months before the store or item began selling)
  const firstPositiveIdx = sanitizedInput.findIndex((v) => v > EPSILON);
  const cleanData = firstPositiveIdx >= 0 ? sanitizedInput.slice(firstPositiveIdx) : [];

  const historyLength = cleanData.length;
  const sumSales = cleanData.reduce((acc, v) => acc + v, 0);

  const baseParams = {
    alpha,
    beta,
    gamma,
    seasonLength,
    historyLength,
  };

  // Tier 1A: Zero-Fill Fallback
  if (cleanData.length === 0 || sumSales <= EPSILON) {
    return createForecastResult(Array(horizon).fill(0), "zero_fill", "low", baseParams);
  }

  // Tier 1B: Flat Naive Fallback (single observation)
  if (cleanData.length === 1) {
    const flatVal = clampNonNegative(Math.round(cleanData[0]));
    return createForecastResult(Array(horizon).fill(flatVal), "flat_naive", "low", baseParams);
  }

  // Helper for Tier 2: Holt Linear Double Exponential Smoothing
  const executeHoltLinear = (): ForecastResult => {
    let level = cleanData[0];
    let trend = cleanData[1] - cleanData[0];

    for (let t = 1; t < cleanData.length; t++) {
      const prevLevel = level;
      const val = cleanData[t];
      level = clampNonNegative(alpha * val + (1 - alpha) * (prevLevel + trend));
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    const forecast: number[] = [];
    for (let h = 1; h <= horizon; h++) {
      const projected = level + h * trend;
      forecast.push(clampNonNegative(Math.round(projected)));
    }

    const confidence: ConfidenceLevel = cleanData.length >= 6 ? "medium" : "low";
    return createForecastResult(forecast, "holt_linear", confidence, baseParams);
  };

  // Tier 2: Fallback when history is shorter than a full season
  if (cleanData.length < seasonLength) {
    return executeHoltLinear();
  }

  // Tier 3: Holt-Winters Multiplicative Triple Exponential Smoothing
  try {
    const average = sumSales / cleanData.length;
    if (average <= EPSILON) {
      return executeHoltLinear();
    }

    // Initialize seasonal factors for the initial cycle
    const seasonalIndices: number[] = [];
    for (let j = 0; j < seasonLength; j++) {
      seasonalIndices.push(safeDiv(cleanData[j], average, 1.0));
    }

    // Normalize seasonal indices so their sum equals seasonLength
    const sumSeasonals = seasonalIndices.reduce((acc, v) => acc + v, 0);
    const normFactor = safeDiv(seasonLength, sumSeasonals, 1.0);
    const smoothSeasonals = seasonalIndices.map((s) => s * normFactor);

    // Initial level and trend
    let level = cleanData[0];
    let trend = safeDiv(cleanData[seasonLength - 1] - cleanData[0], seasonLength, 0);

    // Iterate across historical observations
    for (let t = 0; t < cleanData.length; t++) {
      const val = cleanData[t];
      const prevLevel = level;
      const seasonIdx = t % seasonLength;
      const currentSeasonal = smoothSeasonals[seasonIdx];

      // Deseasonalized level update
      const deseasonalized = safeDiv(val, currentSeasonal, val);
      level = clampNonNegative(alpha * deseasonalized + (1 - alpha) * (prevLevel + trend));

      // Trend update
      trend = beta * (level - prevLevel) + (1 - beta) * trend;

      // Seasonal index update
      const seasonalRatio = safeDiv(val, Math.max(level, EPSILON), currentSeasonal);
      smoothSeasonals[seasonIdx] = gamma * seasonalRatio + (1 - gamma) * currentSeasonal;
    }

    // Generate forecast
    const forecast: number[] = [];
    for (let h = 1; h <= horizon; h++) {
      const seasonTarget = (cleanData.length + h - 1) % seasonLength;
      const pred = (level + h * trend) * smoothSeasonals[seasonTarget];
      forecast.push(clampNonNegative(Math.round(pred)));
    }

    // Verify all predictions are valid finite numbers
    if (forecast.some((v) => !Number.isFinite(v) || isNaN(v))) {
      return executeHoltLinear();
    }

    return createForecastResult(forecast, "holt_winters_multiplicative", "high", baseParams);
  } catch {
    // Graceful fallback to Holt linear upon any numerical anomaly
    return executeHoltLinear();
  }
}

export type StockStatusKey =
  | "critico"
  | "bajo"
  | "normal"
  | "exceso"
  | "sin_control";

export type BadgeColor =
  | "primary"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "light"
  | "dark";

export interface StockStatusInfo {
  key: StockStatusKey;
  label: string;
  color: BadgeColor;
}

/**
 * Valida que los umbrales de stock mínimo y máximo sean consistentes.
 */
export function validateStockThresholds(
  stockMin: number,
  stockMax: number
): { valid: boolean; error?: string } {
  if (Number.isNaN(stockMin) || Number.isNaN(stockMax)) {
    return { valid: false, error: "Los valores de stock deben ser numéricos" };
  }
  if (stockMin < 0 || stockMax < 0) {
    return { valid: false, error: "Los valores de stock no pueden ser negativos" };
  }
  if (stockMax > 0 && stockMax < stockMin) {
    return {
      valid: false,
      error: "El stock máximo no puede ser menor que el stock mínimo",
    };
  }
  return { valid: true };
}

/**
 * Determina el estado del inventario para un ítem en función de su stock y sus umbrales.
 */
export function getStockStatus(
  stock: number,
  stockMin: number,
  stockMax?: number
): StockStatusInfo {
  const max = stockMax ?? 0;

  // 1. Sin control: sin mínimo ni máximo configurados
  if (stockMin <= 0 && max <= 0) {
    return {
      key: "sin_control",
      label: "Sin calibrar",
      color: "light",
    };
  }

  // 2. Crítico: tiene mínimo definido y el stock actual se agotó o es negativo
  if (stockMin > 0 && stock <= 0) {
    return {
      key: "critico",
      label: "Crítico",
      color: "error",
    };
  }

  // 3. Bajo: stock positivo pero menor o igual al mínimo
  if (stockMin > 0 && stock <= stockMin) {
    return {
      key: "bajo",
      label: "Bajo stock",
      color: "warning",
    };
  }

  // 4. Sobre-stock: stock supera el máximo configurado
  if (max > 0 && stock > max) {
    return {
      key: "exceso",
      label: "Sobre-stock",
      color: "info",
    };
  }

  // 5. Nivel normal / saludable
  return {
    key: "normal",
    label: "Saludable",
    color: "success",
  };
}

/**
 * Calcula la cantidad sugerida de reposición para volver al stock objetivo (máximo o mínimo).
 * En política (s, S), se repone cuando stock <= stockMin hasta alcanzar stockMax (o stockMin si no hay max).
 */
export function calculateSuggestedRestock(
  stock: number,
  stockMin: number,
  stockMax: number
): number {
  if (stockMin <= 0 && stockMax <= 0) {
    return 0;
  }

  // Si stock supera el mínimo, no hay necesidad de reponer
  if (stockMin > 0 && stock > stockMin) {
    return 0;
  }

  const target = stockMax > 0 ? stockMax : stockMin;
  if (stock >= target) {
    return 0;
  }

  return Math.max(0, target - stock);
}

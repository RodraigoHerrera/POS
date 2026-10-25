/**
 * Formats a per-unit cost for display: at least 2 and at most 6 decimals,
 * no thousands grouping. Non-finite values render as "0.00".
 * Client-safe: must not import server modules (prisma).
 */
export function formatCostoUnitario(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
        useGrouping: false,
      })
    : "0.00";
}

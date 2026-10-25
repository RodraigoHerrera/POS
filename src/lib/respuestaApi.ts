/**
 * Client-safe helper: must not import server-only modules (validation.ts,
 * next/server). Extracts a user-facing message from an API error body, which
 * routes return as `{ message }` or `{ error }`.
 */
export function mensajeErrorApi(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null) return fallback;
  const { message, error } = data as { message?: unknown; error?: unknown };
  if (typeof message === "string" && message.length > 0) return message;
  if (typeof error === "string" && error.length > 0) return error;
  return fallback;
}

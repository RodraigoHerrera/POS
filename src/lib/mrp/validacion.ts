import { ValidationError, parsePositiveBigInt } from "@/lib/validation";

const HORIZONTE_DEFAULT = 7;
const HORIZONTE_MAX = 60;

/** Horizonte en días: ausente -> 7; si viene, debe ser un entero en [1, 60]. */
export function parseHorizonteDias(value: unknown): number {
  if (value === undefined || value === null) return HORIZONTE_DEFAULT;
  const mensaje = `horizonteDias debe ser un entero entre 1 y ${HORIZONTE_MAX}`;

  let num: number;
  if (typeof value === "number") num = value;
  else if (typeof value === "string" && /^\d+$/.test(value.trim())) num = Number(value.trim());
  else throw new ValidationError(mensaje, "horizonteDias");

  if (!Number.isInteger(num) || num < 1 || num > HORIZONTE_MAX) {
    throw new ValidationError(mensaje, "horizonteDias");
  }
  return num;
}

/** Id de corrida desde el segmento de URL: debe ser un entero positivo (si no, 400). */
export function parseCorridaId(id: string): bigint {
  return parsePositiveBigInt(id, "ID de corrida");
}

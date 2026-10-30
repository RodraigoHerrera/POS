/**
 * A dónde sigue el cajero tras pedir la apertura de caja. Un 409 significa que
 * este empleado ya tiene una caja abierta en la sucursal (la API busca por
 * sucursal + empleado), así que se continúa a ventas en lugar de mostrar un
 * error que dejaba al cajero en un loop sobre "Apertura de Caja".
 */
export function destinoTrasApertura(status: number): "ventas" | "error" {
  if ((status >= 200 && status < 300) || status === 409) return "ventas";
  return "error";
}

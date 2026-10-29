// Helpers para rangos de fechas elegidos en el DatePicker (flatpickr, modo range).

const pad = (n: number) => n.toString().padStart(2, "0");

/** Dia calendario local de `fecha` como YYYY-MM-DD. */
export function formatearDiaLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/**
 * Convierte la seleccion del picker en `{ desde, hasta }`.
 * Devuelve `null` mientras el rango esta incompleto (un solo dia elegido) y un
 * rango vacio cuando se limpia la seleccion.
 */
export function rangoDesdeSeleccion(fechas: readonly Date[]): { desde: string; hasta: string } | null {
  if (fechas.length === 0) return { desde: "", hasta: "" };
  if (fechas.length < 2) return null;
  const [a, b] = [formatearDiaLocal(fechas[0]), formatearDiaLocal(fechas[1])].sort();
  return { desde: a, hasta: b };
}

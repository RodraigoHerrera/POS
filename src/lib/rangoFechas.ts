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

/**
 * Como `rangoDesdeSeleccion`, pero un solo dia elegido ya filtra ese dia. Para
 * filtros locales (sin pedir al servidor): con `null` el filtro anterior seguia
 * activo mientras el calendario ya marcaba el dia nuevo, y parecia no filtrar.
 */
export function rangoInmediatoDesdeSeleccion(fechas: readonly Date[]): { desde: string; hasta: string } {
  if (fechas.length === 1) {
    const dia = formatearDiaLocal(fechas[0]);
    return { desde: dia, hasta: dia };
  }
  return rangoDesdeSeleccion(fechas) ?? { desde: "", hasta: "" };
}

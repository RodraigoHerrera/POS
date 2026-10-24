/** Unit shown when an item has no usable unidad_code. */
export const UNIDAD_FALLBACK = "u";

export type UnidadOption = { value: string; label: string };

/** Single source of allowed inventory base units, shared by create and edit forms. */
export const UNIDADES_OPTIONS: readonly UnidadOption[] = [
  { value: "unidad", label: "Unidad" },
  { value: "caja", label: "Caja" },
  { value: "paquete", label: "Paquete" },
  { value: "litro", label: "Litro" },
  { value: "kilogramo", label: "Kilogramo" },
  { value: "gramo", label: "Gramo" },
  { value: "mililitro", label: "Mililitro" },
];

/**
 * Builds the unit options for a Select. Returns a new array copy of the catalog;
 * when `actual` is a non-empty code outside the catalog (legacy data such as "kg"),
 * it is appended with its raw value so an untouched save round-trips unchanged.
 */
export function opcionesUnidad(actual?: string | null): UnidadOption[] {
  const options = [...UNIDADES_OPTIONS];
  if (actual?.trim() && !options.some((o) => o.value === actual)) {
    options.push({ value: actual, label: `${actual.trim()} (actual)` });
  }
  return options;
}

/** Normalizes a free-text unit code: trimmed, or "u" when null/empty/whitespace. */
export function labelUnidad(code?: string | null): string {
  const trimmed = code?.trim();
  return trimmed ? trimmed : UNIDAD_FALLBACK;
}

/**
 * Hint text for the selected item, or undefined when nothing is selected
 * or the id is not an own key of the loaded unit lookup.
 */
export function hintUnidad(
  itemId: string,
  unidades: Record<string, string>
): string | undefined {
  if (itemId === "" || !Object.hasOwn(unidades, itemId)) return undefined;
  return `Unidad: ${labelUnidad(unidades[itemId])}`;
}

// Pure helpers for the recipe/extras editors (recetasCard): build the insumo
// options and make sure every already-saved row has a matching option.

export type Option = { value: string; label: string };

type ItemLike = {
  id: string | number;
  nombre: string;
  tipo: string;
  unidad_code?: string | null;
};

type RowLike = {
  itemId: string;
  nombre?: string;
  unidad_code?: string;
};

const buildLabel = (nombre: string | undefined, unidad: string | null | undefined) =>
  `${nombre ?? ""} (${unidad || "u"})`;

// Only non-vendible items can be used as insumos.
export function toInsumoOptions(items: ItemLike[]): Option[] {
  return items
    .filter((i) => i.tipo !== "vendible")
    .map((i) => ({ value: String(i.id), label: buildLabel(i.nombre, i.unidad_code) }));
}

// Appends an option for every row whose insumo is not selectable anymore
// (inactive or retyped to vendible) so the row is neither blank nor dropped on save.
export function withMissingOptions(options: Option[], rows: RowLike[]): Option[] {
  const known = new Set(options.map((o) => o.value));
  const result = [...options];
  for (const row of rows) {
    if (!row.itemId || known.has(row.itemId)) continue;
    known.add(row.itemId);
    result.push({ value: row.itemId, label: buildLabel(row.nombre, row.unidad_code) });
  }
  return result;
}

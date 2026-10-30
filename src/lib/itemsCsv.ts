import { decimalCSV, generarCSV, nombreArchivoCSV } from "@/lib/csv";

// Exportacion CSV del modal Catalogo de Items. Recibe los items tal como los
// devuelve /api/inventarios/items (ya filtrados en el cliente).

export interface ItemCSV {
  sku: string | null;
  nombre: string;
  tipo: string;
  unidad_code: string;
  activo: boolean;
  costo_estandar: string | null;
}

const CABECERAS = ["SKU", "Nombre", "Tipo", "Unidad", "Costo estándar", "Estado"] as const;

export function construirCSVItems(items: readonly ItemCSV[]): string {
  const filas = items.map((i) => [
    i.sku ?? "",
    i.nombre,
    i.tipo,
    i.unidad_code,
    i.costo_estandar === null ? "" : decimalCSV(Number(i.costo_estandar)),
    i.activo ? "Activo" : "Inactivo",
  ]);
  return generarCSV(CABECERAS, filas);
}

export function nombreArchivoItems(fecha: Date, tz?: string): string {
  return nombreArchivoCSV("items", fecha, tz);
}

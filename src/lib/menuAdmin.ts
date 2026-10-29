// Helpers puros para la gestión del catálogo en /admin/menu.

type ProductoBase = { nombre: string; categoria: string; estado: string };

export type FiltroEstadoProducto = "todos" | "activos" | "inactivos";

export type FiltrosProductos = {
  texto: string;
  categoria: string | null;
  estado: FiltroEstadoProducto;
};

export type ResumenProductos = {
  total: number;
  activos: number;
  inactivos: number;
};

// El estado se guarda con distintas mayúsculas ("activo" / "Activo").
export function esProductoActivo(estado: string): boolean {
  return estado.toLowerCase() === "activo";
}

// Minúsculas y sin tildes, para que "acompanamientos" encuentre "Acompañamientos".
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function resumenProductos(productos: ProductoBase[]): ResumenProductos {
  const activos = productos.filter((p) => esProductoActivo(p.estado)).length;
  return { total: productos.length, activos, inactivos: productos.length - activos };
}

// Categorías únicas para los chips de filtro y las sugerencias del formulario.
export function categoriasDeProductos(productos: ProductoBase[]): string[] {
  const unicas = new Set(productos.map((p) => p.categoria.trim()).filter(Boolean));
  return [...unicas].sort((a, b) => a.localeCompare(b, "es"));
}

// El texto busca en nombre y categoría.
export function filtrarProductos<T extends ProductoBase>(productos: T[], filtros: FiltrosProductos): T[] {
  const texto = normalizar(filtros.texto);
  return productos.filter((p) => {
    if (filtros.categoria !== null && p.categoria.trim() !== filtros.categoria) return false;
    if (filtros.estado === "activos" && !esProductoActivo(p.estado)) return false;
    if (filtros.estado === "inactivos" && esProductoActivo(p.estado)) return false;
    if (!texto) return true;
    return normalizar(p.nombre).includes(texto) || normalizar(p.categoria).includes(texto);
  });
}

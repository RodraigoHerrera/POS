// Tipos compartidos entre los componentes del flujo /cajero/ventas
// (catálogo, drawer de personalización, carrito/checkout).

export interface Item {
  id: number;
  nombre: string;
  precio: string;
  estado: string;
  // Nullable en la base de datos (producto.categoria / descripcion / imagenUrl).
  categoria: string | null;
  descripcion: string | null;
  imagenUrl?: string | null;
  item_inventario_id?: string;
}

// Extra disponible para un producto (modificadorProducto), resuelto desde
// /api/inventarios/modificadores.
export interface ExtraOption {
  id: string;
  nombre: string;
  precio: number;
}

export interface CartItem {
  cartId: string;
  product: Item;
  quantity: number;
  extras: ExtraOption[];
  notes: string;
}

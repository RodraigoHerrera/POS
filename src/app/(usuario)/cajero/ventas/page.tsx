"use client";

import React, { useState, useMemo } from "react";
import {useRouter}  from "next/navigation";
import { useFetchData } from "@/hooks/useFetchData";
import ProductCardSkeleton from "@/components/ui/skeleton/ProductCardSkeleton";

// --- Interfaces ---

interface Item {
  id: number;
  nombre: string;
  precio: string; 
  estado: string;
  categoria: string;
  descripcion: string;
  fotoUrl?: string;
}

interface CartItem {
  cartId: string;
  product: Item;
  quantity: number;
  extras: string[];
  notes: string;
}

// --- Componente de Tarjeta (Inline para asegurar funcionamiento) ---
// Puedes reemplazar esto por tu import de @/components/ui/productos/ProductosCaja
const ProductCard = ({ item }: { item: Item }) => (
  <div className="flex flex-col gap-2 p-2 h-full">
    <div className="relative w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
      {item.fotoUrl ? (
        <img src={item.fotoUrl} alt={item.nombre} className="w-full h-full object-cover" />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400 bg-gray-200 dark:bg-gray-700">
           <span className="text-xs">Sin Foto</span>
        </div>
      )}
    </div>
    <div className="flex justify-between items-start">
      <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm line-clamp-2 leading-tight">
        {item.nombre}
      </h3>
      <span className="font-bold text-blue-600 text-sm whitespace-nowrap ml-2">
        ${parseFloat(item.precio).toFixed(2)}
      </span>
    </div>
    <p className="text-xs text-gray-500 line-clamp-2">
      {item.descripcion || "Sin descripción"}
    </p>
  </div>
);

// --- Componente Principal ---

export default function Ventas() {
  const router = useRouter();
  const { data: products, loading: loadingProducts } = useFetchData<Item[]>("/api/inventarios/productos", []);

  // Estado para el Carrito (Columna 1)
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Estado para la Selección y Edición (Columna 3)
  const [selectedProduct, setSelectedProduct] = useState<Item | null>(null);
  const [currentExtras, setCurrentExtras] = useState<string[]>([]);
  const [currentNotes, setCurrentNotes] = useState<string>("");

  // Estado para controlar el envío
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------- Lógica del Carrito (Columna 1) ----------

  const totalCart = useMemo(() => {
    return cart.reduce((acc, item) => {
      const basePrice = parseFloat(item.product.precio);
      return acc + (basePrice * item.quantity);
    }, 0);
  }, [cart]);

  const handleRemoveItem = (cartId: string) => {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const handleCancelOrder = () => {
    if (confirm("¿Estás seguro de cancelar todo el pedido?")) {
      setCart([]);
      setSelectedProduct(null);
    }
  };

  // ✅ AQUÍ ESTÁ LA LÓGICA APLICADA
  const handleCommandOrder = async () => {
    if (cart.length === 0) return alert("El pedido está vacío");
    
    setIsSubmitting(true);

    try {
      // 1. Preparamos el payload según lo que espera route.ts
      const payload = {
        mesa: "Mesa 1", // Puedes hacerlo dinámico agregando un input
        cliente: "Cliente Mostrador",
        items: cart.map(item => ({
          producto_id: item.product.id,
          cantidad: item.quantity,
          precio_unit: parseFloat(item.product.precio),
          notas: item.notes,
          extras: item.extras 
        }))
      };

      // 2. Enviamos al endpoint
      const response = await fetch('/api/caja/registrarPedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error desconocido al procesar el pedido");
      }

      // 3. Éxito
      alert(`✅ Pedido #${result.pedidoId} enviado a cocina correctamente!`);
      router.push(`/cajero/metodos-pago?id=${result.pedidoId}`); // Redirigir a métodos de pago
      setCart([]); // Limpiamos el carrito
      setSelectedProduct(null); // Limpiamos la selección

    } catch (error: any) {
      console.error("Error enviando pedido:", error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsSubmitting(false); // Desbloqueamos el botón
    }
  };

  // ---------- Lógica de Selección (Columna 2) ----------

  const handleSelectProduct = (product: Item) => {
    if (isSubmitting) return; // Bloquear selección mientras se envía
    setSelectedProduct(product);
    setCurrentExtras([]);
    setCurrentNotes("");
  };

  // ---------- Lógica de Edición (Columna 3) ----------

  const toggleExtra = (extraName: string) => {
    setCurrentExtras((prev) => 
      prev.includes(extraName) 
        ? prev.filter(e => e !== extraName)
        : [...prev, extraName]
    );
  };

  const handleConfirmAdd = () => {
    if (!selectedProduct) return;

    const newItem: CartItem = {
      cartId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      product: selectedProduct,
      quantity: 1,
      extras: currentExtras,
      notes: currentNotes,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedProduct(null); 
  };

  // ---------- Render ----------

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full gap-4 p-4 bg-gray-50 dark:bg-gray-900 overflow-hidden">
      
      {/* --- COLUMNA 1: Resumen del Pedido (25%) --- */}
      <div className="flex w-1/4 flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950 h-full">
        <div className="border-b p-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Pedido Actual</h2>
          <span className="text-sm text-gray-500">{cart.length} ítems</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {cart.length === 0 ? (
            <div className="mt-10 text-center text-gray-400 italic">Pedido vacío</div>
          ) : (
            cart.map((item) => (
              <div key={item.cartId} className="relative rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm hover:bg-gray-100 dark:bg-gray-900 dark:border-gray-800 dark:hover:bg-gray-800 transition-colors">
                <div className="flex justify-between font-medium text-gray-800 dark:text-gray-200">
                  <span>{item.product.nombre}</span>
                  <span>${parseFloat(item.product.precio).toFixed(2)}</span>
                </div>
                {item.extras.length > 0 && (
                  <div className="text-xs text-blue-600 mt-1">+ {item.extras.join(", ")}</div>
                )}
                {item.notes && (
                  <div className="text-xs text-gray-500 italic mt-1">"{item.notes}"</div>
                )}
                <button 
                  onClick={() => handleRemoveItem(item.cartId)}
                  disabled={isSubmitting}
                  className="absolute -right-2 -top-2 h-6 w-6 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 shadow-sm"
                >
                  <span className="text-xs font-bold">X</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer: Totales y Botones */}
        <div className="border-t bg-gray-50 p-4 dark:bg-gray-900 shrink-0 rounded-b-xl">
          <div className="mb-4 flex justify-between text-xl font-bold text-gray-800 dark:text-gray-100">
            <span>Total:</span>
            <span>${totalCart.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={handleCancelOrder}
              disabled={isSubmitting}
              className="rounded-lg bg-red-100 px-4 py-2 font-medium text-red-600 transition hover:bg-red-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleCommandOrder}
              disabled={isSubmitting || cart.length === 0}
              className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700 shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Enviando...</span>
              ) : (
                "Comandar"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- COLUMNA 2: Catálogo (45%) --- */}
      <div className="flex w-[45%] flex-col rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950 h-full">
        <h2 className="mb-4 text-lg font-bold text-gray-800 dark:text-gray-100 shrink-0">Catálogo</h2>
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {loadingProducts
              ? Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((item) => (
              <div 
                key={item.id} 
                onClick={() => !isSubmitting && handleSelectProduct(item)}
                className={`cursor-pointer transition-all duration-200 rounded-lg border-2 overflow-hidden
                  ${selectedProduct?.id === item.id 
                    ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50 dark:bg-blue-900/20' 
                    : ' hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
                  }`}
              >
                {/* Usamos el componente inline para evitar errores de importación en la preview */}
                <ProductCard item={item} /> 
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- COLUMNA 3: Personalización (30%) --- */}
      <div className="flex w-[30%] flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 h-full">
        {!selectedProduct ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <p>Selecciona un producto</p>
            <p>para ver detalles</p>
          </div>
        ) : (
          <>
            {/* Header del Producto */}
            <div className="border-b p-5 bg-gray-50 dark:bg-gray-900 rounded-t-xl shrink-0">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white line-clamp-2">{selectedProduct.nombre}</h2>
              <p className="text-lg font-semibold text-blue-600 mt-1">${parseFloat(selectedProduct.precio).toFixed(2)}</p>
              <p className="mt-2 text-sm text-gray-500 line-clamp-3">{selectedProduct.descripcion}</p>
            </div>

            {/* Cuerpo de Edición */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Sección Extras */}
              <div>
                <h3 className="mb-3 font-semibold text-gray-700 dark:text-gray-300">Agregar Extras:</h3>
                <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                  <p className="text-xs text-gray-400 italic text-center">Configura tus extras aquí</p>
                </div>
              </div>

              {/* Sección Notas */}
              <div>
                <h3 className="mb-3 font-semibold text-gray-700 dark:text-gray-300">Notas de cocina:</h3>
                <textarea
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  rows={4}
                  placeholder="Ej: Sin cebolla, carne bien cocida..."
                  value={currentNotes}
                  onChange={(e) => setCurrentNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Botón Confirmar */}
            <div className="border-t p-5 shrink-0">
              <button 
                onClick={handleConfirmAdd}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-lg font-bold text-white transition hover:bg-blue-700 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
              >
                + Confirmar y Agregar
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
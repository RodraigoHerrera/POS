"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFetchData } from "@/hooks/useFetchData";
import TopBarCajero from "@/components/caja/TopBarCajero";
import ProductCatalogGrid from "@/components/caja/ProductCatalogGrid";
import PersonalizeDrawer from "@/components/caja/PersonalizeDrawer";
import CartCheckoutPanel from "@/components/caja/CartCheckoutPanel";
import type { Item, CartItem, ExtraOption } from "@/components/caja/types";

interface SesionCaja {
  empleadoNombre: string;
  fechaApertura: string;
}

export default function Ventas() {
  const router = useRouter();
  const { data: products, loading: loadingProducts } = useFetchData<Item[]>("/api/inventarios/productos", []);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cliente, setCliente] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drawer de personalización: producto en edición (null = cerrado)
  const [customizing, setCustomizing] = useState<Item | null>(null);

  // Feedback de "agregado" tras un quick-add (flash en la tarjeta)
  const [justAddedId, setJustAddedId] = useState<number | null>(null);

  // Identidad/turno para la barra superior (no bloquea la pantalla si falla)
  const [sesionCaja, setSesionCaja] = useState<SesionCaja | null>(null);

  useEffect(() => {
    fetch("/api/caja/resumen", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSesionCaja({ empleadoNombre: data.empleadoNombre, fechaApertura: data.fechaApertura });
      })
      .catch(() => {});
  }, []);

  const flashAdded = (productId: number) => {
    setJustAddedId(productId);
    window.setTimeout(() => setJustAddedId((current) => (current === productId ? null : current)), 600);
  };

  const handleQuickAdd = (product: Item) => {
    if (isSubmitting) return;
    setCart((prev) => [
      ...prev,
      {
        cartId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        product,
        quantity: 1,
        extras: [],
        notes: "",
      },
    ]);
    flashAdded(product.id);
  };

  const handleCustomize = (product: Item) => {
    if (isSubmitting) return;
    setCustomizing(product);
  };

  const handleDrawerConfirm = ({
    quantity,
    extras,
    notes,
  }: {
    quantity: number;
    extras: ExtraOption[];
    notes: string;
  }) => {
    if (!customizing) return;
    setCart((prev) => [
      ...prev,
      {
        cartId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        product: customizing,
        quantity,
        extras,
        notes,
      },
    ]);
    setCustomizing(null);
  };

  const handleRemoveItem = (cartId: string) => {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const handleCancelOrder = () => {
    if (confirm("¿Estás seguro de cancelar todo el pedido?")) {
      setCart([]);
      setCustomizing(null);
    }
  };

  const handleCommandOrder = async () => {
    if (cart.length === 0) return;

    setIsSubmitting(true);

    try {
      const payload = {
        mesa: "Mesa 1", // Fuera de alcance por ahora: sin selector de mesa en la UI
        cliente: cliente.trim() || "Cliente Mostrador",
        items: cart.map((item) => ({
          producto_id: item.product.id,
          cantidad: item.quantity,
          precio_unit: parseFloat(item.product.precio),
          notas: item.notes,
          extras: item.extras.map((e) => e.id),
        })),
      };

      const response = await fetch("/api/caja/registrarPedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error desconocido al procesar el pedido");
      }

      router.push(`/cajero/metodos-pago?id=${result.pedidoId}&total=${result.total}&cliente=${encodeURIComponent(payload.cliente)}`);
      setCart([]);
      setCustomizing(null);
      setCliente("");
    } catch (error: any) {
      console.error("Error enviando pedido:", error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900">
      <TopBarCajero
        variant="default"
        empleadoNombre={sesionCaja?.empleadoNombre ?? ""}
        turnoInicio={sesionCaja?.fechaApertura}
        cliente={cliente}
        onClienteChange={setCliente}
        clienteDisabled={isSubmitting}
        onVerPedidos={() => router.push("/cajero/pedidos")}
        onCerrarCaja={() => router.push("/cajero/cierre")}
      />

      <div className="flex w-full flex-1 overflow-hidden">
        {/* Catálogo: contenedor relative para anclar el drawer encima de él, no de todo el layout */}
        <div className="relative flex-1 overflow-hidden">
          <ProductCatalogGrid
            products={products}
            loading={loadingProducts}
            onQuickAdd={handleQuickAdd}
            onCustomize={handleCustomize}
            justAddedId={justAddedId}
          />
          <PersonalizeDrawer
            product={customizing}
            onClose={() => setCustomizing(null)}
            onConfirm={handleDrawerConfirm}
          />
        </div>

        {/* Carrito + checkout: ancla derecha, ancho fijo */}
        <div className="w-[384px] shrink-0">
          <CartCheckoutPanel
            cart={cart}
            onRemoveItem={handleRemoveItem}
            onCancelOrder={handleCancelOrder}
            onCommandOrder={handleCommandOrder}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}

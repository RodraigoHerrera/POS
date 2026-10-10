"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

function VentasContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("editId");

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

  useEffect(() => {
    if (editId && products.length > 0) {
      fetch(`/api/caja/pedido?id=${editId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.pedido) {
            setCliente(data.pedido.cliente || "");
            const loadedCart: CartItem[] = data.pedido.items.map((item: any) => {
              const product = products.find((p) => p.id.toString() === item.producto_id);
              return {
                cartId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                product: product || { ...item.producto, id: parseInt(item.producto_id) },
                quantity: item.cantidad,
                extras: item.extras.map((e: any) => ({
                  id: e.item_inv_id || 0, // Fallback if no inv id
                  nombre: e.nombre,
                  precio: Number(e.precio),
                })),
                notes: item.notas || "",
              };
            });
            setCart(loadedCart);
          }
        })
        .catch(console.error);
    }
  }, [editId, products]);

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
    const ticketWin = window.open("about:blank", "_blank");

    try {
      const payload = {
        ...(editId ? { pedidoId: editId } : {}),
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

      const endpoint = editId ? "/api/caja/editarPedido" : "/api/caja/registrarPedido";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error desconocido al procesar el pedido");
      }

      if (result.droppedItems && result.droppedItems.length > 0) {
        const productNames = result.droppedItems.map((di: any) => di.productName || 'Producto').join(", ");
        alert(`Atención: Se omitieron los siguientes items por falta de stock: ${productNames}`);
      }

      if (result.isCorrection) {
        alert("El pedido actualizado es una corrección. Se ha generado una nota para cocina.");
      }

      if (ticketWin && result.pedidoId) {
        ticketWin.location.href = `/cajero/comanda/${result.pedidoId}`;
      } else if (ticketWin) {
        ticketWin.close();
      }

      if (!editId) {
        router.push(`/cajero/metodos-pago?id=${result.pedidoId}&total=${result.total}&cliente=${encodeURIComponent(payload.cliente)}`);
      } else {
        router.push("/cajero/pedidos");
      }
      setCart([]);
      setCustomizing(null);
      setCliente("");
    } catch (error: any) {
      console.error("Error enviando pedido:", error);
      alert(`❌ Error: ${error.message}`);
      if (ticketWin) {
        ticketWin.close();
      }
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

      <div className="flex w-full flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Catálogo: contenedor relative para anclar el drawer encima de él, no de todo el layout */}
        <div className="relative flex-1 overflow-hidden h-3/5 lg:h-auto shrink-0 lg:shrink">
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

        {/* Carrito + checkout: ancla derecha, ancho fijo en desktop */}
        <div className="w-full lg:w-[384px] shrink-0 h-2/5 lg:h-auto border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 flex flex-col">
          <CartCheckoutPanel
            cart={cart}
            onRemoveItem={handleRemoveItem}
            onCancelOrder={handleCancelOrder}
            onCommandOrder={handleCommandOrder}
            isSubmitting={isSubmitting}
            isEditing={!!editId}
          />
        </div>
      </div>
    </div>
  );
}

export default function Ventas() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Cargando...</div>}>
      <VentasContent />
    </Suspense>
  );
}

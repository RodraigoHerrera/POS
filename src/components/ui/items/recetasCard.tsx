"use client";

import React, { useState, useCallback, useEffect } from "react";
// Asegúrate de que estas rutas de importación sean correctas en tu proyecto
import { Plus } from "lucide-react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "../modal";
import Button from "../button/Button";
import Image from "next/image";
import Select from "@/components/form/Select";
import Label from "@/components/form/Label";

// --- Interfaces ---

// Representa un ingrediente dentro de la receta en el frontend
interface Insumo {
  id: string;      // ID único temporal para el frontend (key de React)
  itemId: string;  // El ID del producto del inventario que se usa como insumo
  nombre?: string; // Nombre para mostrar en UI (opcional)
  cantidad: number;
}

// Representa un extra (modificadorProducto): mismo concepto que un Insumo de
// receta, pero con un precio que se cobra al cliente además del costo del insumo.
interface ExtraRow extends Insumo {
  precio: number;
}

// Representa el producto principal
interface InventoryItem {
  id: number;
  tipo: string;
  nombre: string;
  sku: string;
  unidad_code: string;
  fotoUrl?: string;
  receta?: Insumo[];
}

interface InventoryItemCardProps {
  itemData: InventoryItem;
  onSaved?: () => void;
}

type Option = { value: string; label: string };

// --- Utility: Generador de IDs seguro ---
// Esto reemplaza a crypto.randomUUID() para evitar errores en navegadores antiguos o sin HTTPS
const generateId = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    try {
      return window.crypto.randomUUID();
    } catch (e) {
      // Fallback si falla crypto
    }
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export default function InventoryItemCard({ itemData, onSaved }: InventoryItemCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [isSaving, setIsSaving] = useState(false);

  // Lista de items disponibles para seleccionar en el select
  const [itemsOptions, setItemsOptions] = useState<Option[]>([]);

  // Estado para manejar la lista dinámica de la receta
  const [recetaActual, setRecetaActual] = useState<Insumo[]>([]);

  // --- Extras (modificadorProducto): mismo patrón que la receta, pero
  // representan insumos opcionales que el cajero puede agregar al pedido
  // (ej. "+Tocino") y que también se descuentan de inventario vía FEFO.
  const { isOpen: isExtrasOpen, openModal: openExtrasModal, closeModal: closeExtrasModal } = useModal();
  const [isSavingExtras, setIsSavingExtras] = useState(false);
  const [extrasOptions, setExtrasOptions] = useState<Option[]>([]);
  const [extrasActual, setExtrasActual] = useState<ExtraRow[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);

  // Costo teórico (BOM x costo_promedio actual) de este producto, visible en la tarjeta
  const [costoTeorico, setCostoTeorico] = useState<number | null>(null);

  useEffect(() => {
    const fetchCostoTeorico = async () => {
      try {
        const res = await fetch(`/api/recetas/costoTeorico?itemId=${itemData.id}`);
        if (res.ok) {
          const data = await res.json();
          setCostoTeorico(data.costoTeoricoUnitario);
        }
      } catch (error) {
        console.error("Error cargando costo teórico:", error);
      }
    };
    fetchCostoTeorico();
  }, [itemData.id, itemData.receta]);

  // Sincronizar el estado de la receta cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      // 1. Cargar Items disponibles para el Select
      const fetchItems = async () => {
  try {
    const res = await fetch('/api/inventarios/items');
    if (res.ok) {
      const data = await res.json();
      
      // MODIFICACIÓN AQUÍ:
      // Primero filtramos, luego mapeamos
      const options = data
        .filter((i: any) => i.tipo !== "vendible") // <--- Filtro agregado
        .map((i: any) => ({
          value: String(i.id),
          label: `${i.nombre} (${i.unidad_code || 'u'})`
        }));
        
      setItemsOptions(options);
    }
  } catch (error) {
    console.error("Error cargando lista de items:", error);
  }
};
      fetchItems();

      // 2. Cargar receta existente del item
      if (itemData.receta && itemData.receta.length > 0) {
        const recetaConIds = itemData.receta.map(insumo => ({
          ...insumo,
          // Usamos generateId si no viene ID, asegurando string para keys de React
          id: insumo.id ? String(insumo.id) : generateId(),
          itemId: String(insumo.itemId || insumo.id), // Aseguramos que itemId sea string
          cantidad: Number(insumo.cantidad)
        }));
        setRecetaActual(recetaConIds);
      } else {
        setRecetaActual([]);
      }
    }
  }, [isOpen, itemData.receta]);

  // Sincronizar el estado de extras cuando se abre su modal
  useEffect(() => {
    if (!isExtrasOpen) return;

    const fetchItems = async () => {
      try {
        const res = await fetch('/api/inventarios/items');
        if (res.ok) {
          const data = await res.json();
          const options = data
            .filter((i: any) => i.tipo !== "vendible")
            .map((i: any) => ({
              value: String(i.id),
              label: `${i.nombre} (${i.unidad_code || 'u'})`
            }));
          setExtrasOptions(options);
        }
      } catch (error) {
        console.error("Error cargando lista de items:", error);
      }
    };

    const fetchExtrasActuales = async () => {
      setLoadingExtras(true);
      try {
        const res = await fetch(`/api/inventarios/modificadores?itemVendibleId=${itemData.id}`);
        if (res.ok) {
          const data = await res.json();
          setExtrasActual(
            data.map((m: any) => ({
              id: generateId(),
              itemId: String(m.itemInsumoId),
              nombre: m.nombre,
              cantidad: Number(m.delta_cantidad),
              precio: Number(m.precio),
            }))
          );
        }
      } catch (error) {
        console.error("Error cargando extras del producto:", error);
      } finally {
        setLoadingExtras(false);
      }
    };

    fetchItems();
    fetchExtrasActuales();
  }, [isExtrasOpen, itemData.id]);

  // ---- Handlers de la Receta Dinámica ----

  // Añadir una nueva fila vacía
  const handleAddInsumo = () => {
    setRecetaActual([
      ...recetaActual,
      // AQUÍ USAMOS LA FUNCIÓN SEGURA
      { id: generateId(), itemId: "", nombre: "", cantidad: 0 },
    ]);
  };

  // Eliminar una fila
  const handleRemoveInsumo = (idToRemove: string) => {
    setRecetaActual(prev => prev.filter(i => i.id !== idToRemove));
  };

  // Actualizar datos de una fila (ItemId o Cantidad)
  const handleUpdateInsumo = (id: string, field: keyof Insumo, value: string | number) => {
    setRecetaActual(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // ---- Handler de Envío Principal ----
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;

    // Validación simple
    const hasInvalid = recetaActual.some(i => !i.itemId || Number(i.cantidad) <= 0);
    if (hasInvalid) {
        alert("Por favor revisa que todos los insumos tengan item y cantidad mayor a 0.");
        return;
    }

    setIsSaving(true);

    try {
      // Construimos el payload limpio
      const payload = {
        ...itemData,     // Spread del itemData original (ya incluye el id)
        receta: recetaActual.map(i => ({
             itemId: i.itemId,          // ID del insumo
             cantidad: Number(i.cantidad) // Cantidad numérica
        })),
      };

      const res = await fetch(`/api/inventarios/modificarReceta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("Respuesta al guardar receta:", res);
      console.log("Payload enviado:", payload);

      if (!res.ok) {
        const text = await res.text();
        console.error("Error al guardar receta:", text);
        alert("Error al guardar: " + text);
        return;
      }

      closeModal();
      onSaved?.(); // Refrescar lista padre
    } catch (err) {
      console.error("Fallo de red o servidor:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Handlers de Extras Dinámicos ----

  const handleAddExtra = () => {
    setExtrasActual([
      ...extrasActual,
      { id: generateId(), itemId: "", nombre: "", cantidad: 0, precio: 0 },
    ]);
  };

  const handleRemoveExtra = (idToRemove: string) => {
    setExtrasActual(prev => prev.filter(i => i.id !== idToRemove));
  };

  const handleUpdateExtra = (id: string, field: keyof ExtraRow, value: string | number) => {
    setExtrasActual(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSubmitExtras = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSavingExtras) return;

    const hasInvalid = extrasActual.some(i => !i.itemId || Number(i.cantidad) <= 0);
    if (hasInvalid) {
      alert("Por favor revisa que todos los extras tengan item y cantidad mayor a 0.");
      return;
    }

    setIsSavingExtras(true);

    try {
      const payload = {
        id: itemData.id,
        modificadores: extrasActual.map(i => ({
          itemId: i.itemId,
          cantidad: Number(i.cantidad),
          precio: Number(i.precio)
        })),
      };

      const res = await fetch(`/api/inventarios/modificarModificadores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error al guardar extras:", text);
        alert("Error al guardar: " + text);
        return;
      }

      closeExtrasModal();
      onSaved?.();
    } catch (err) {
      console.error("Fallo de red o servidor:", err);
    } finally {
      setIsSavingExtras(false);
    }
  };

  // ---- UI ----
  return (
    <>
      {/* VISTA DE TARJETA (Card View) */}
      <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-col items-center gap-6 xl:flex-row">
            {/* Imagen del producto */}
            <div className="h-20 w-20  overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                {itemData.fotoUrl ? (
                  <Image width={80} height={80} src={itemData.fotoUrl} alt={itemData.nombre} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                  </div>
                )}
            </div>

            <div className="text-center xl:text-left">
              <h4 className="mb-2 text-lg font-bold text-gray-900 dark:text-white/90">
                {itemData.nombre}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left font-medium">
                <p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">SKU: {itemData.sku}</p>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Unidad base: <span className="text-gray-700 dark:text-gray-300">{itemData.unidad_code}</span></p>
                {costoTeorico !== null && (
                  <>
                    <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block" />
                    <p
                      className="text-sm text-success-600 dark:text-success-400"
                      title="Receta (BOM) x costo promedio actual de cada insumo en esta sucursal"
                    >
                      Costo teórico: <span className="font-semibold">Bs {costoTeorico.toFixed(2)}</span>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Botones de Edición */}
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button
              onClick={openModal}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 lg:w-auto"
            >
              <svg className="fill-current" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z" />
              </svg>
              Editar Receta
            </button>

            {itemData.tipo === "vendible" && (
              <button
                onClick={openExtrasModal}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 lg:w-auto"
              >
                <Plus size={16} />
                Editar Extras
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE EDICIÓN */}
      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[800px] w-full">
        <div className="no-scrollbar relative w-full flex flex-col max-h-[90vh] rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-8">
          <div className="px-2 mb-4">
            <h4 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white/90">
              Receta de: {itemData.nombre}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Define los insumos necesarios para producir una unidad de ({itemData.unidad_code}).
            </p>
          </div>

                       {/* Header de la lista */}
             <div className="mb-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 px-2">
                <h5 className="text-lg font-medium text-gray-800 dark:text-white/90">
                  Lista de Insumos
                </h5>
                <Button size="sm" variant="primary" onClick={handleAddInsumo}>
                  + Añadir Insumo
                </Button>
              </div>


          <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSubmit}>


              {/* --- LISTA DINÁMICA DE INSUMOS --- */}
              <div className="custom-scrollbar flex-1 overflow-y-auto px-2 pb-3 space-y-3">
                {recetaActual.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-lg dark:border-gray-800">
                        <p className="text-gray-400">No hay insumos agregados aún.</p>
                    </div>
                ) : (
                    recetaActual.map((insumo, index) => (
                        <div key={insumo.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50 sm:flex-row sm:items-end transition-all">
                            
                            {/* Selector de Item */}
                            <div className="flex-1">
                                <Label className="text-xs mb-1">Insumo / Material</Label>
                                <Select
                                    options={itemsOptions}
                                    placeholder={"Seleccionar Item"}
                                    onChange={(val) => handleUpdateInsumo(insumo.id, "itemId", val)}
                                    className="dark:bg-gray-900"
                                />
                            </div>

                            {/* Campo Cantidad */}
                            <div className="w-full sm:w-32">
                                <Label className="text-xs mb-1">Cantidad</Label>
                                <input 
                                    type="number" 
                                    min="0"
                                    step="0.01"
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    placeholder="0.00"
                                    value={insumo.cantidad}
                                    onChange={(e) => handleUpdateInsumo(insumo.id, "cantidad", e.target.value)}
                                />
                            </div>

                            {/* Botón Eliminar Fila */}
                            <button
                                type="button"
                                onClick={() => handleRemoveInsumo(insumo.id)}
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 dark:border-red-900/30 dark:hover:bg-red-900/20 transition-colors"
                                title="Eliminar insumo"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                            </button>
                        </div>
                    ))
                )}
              </div>

            {/* Footer del Modal */}
            <div className="mt-4 flex items-center justify-end gap-3 px-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={closeModal}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button size="sm"  disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* MODAL DE EXTRAS */}
      <Modal isOpen={isExtrasOpen} onClose={closeExtrasModal} className="m-4 max-w-[800px] w-full">
        <div className="no-scrollbar relative w-full flex flex-col max-h-[90vh] rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-8">
          <div className="px-2 mb-4">
            <h4 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white/90">
              Extras de: {itemData.nombre}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Define los insumos opcionales que el cajero puede agregar al pedido (ej. "+Tocino"). Cada extra descuenta inventario igual que la receta base.
            </p>
          </div>

          {/* Header de la lista */}
          <div className="mb-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 px-2">
            <h5 className="text-lg font-medium text-gray-800 dark:text-white/90">
              Lista de Extras
            </h5>
            <Button size="sm" variant="primary" onClick={handleAddExtra} disabled={loadingExtras}>
              + Añadir Extra
            </Button>
          </div>

          <form className="flex flex-col flex-1 overflow-hidden" onSubmit={handleSubmitExtras}>

            {/* --- LISTA DINÁMICA DE EXTRAS --- */}
            <div className="custom-scrollbar flex-1 overflow-y-auto px-2 pb-3 space-y-3">
              {loadingExtras ? (
                <div className="py-10 text-center text-gray-400">Cargando extras...</div>
              ) : extrasActual.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-lg dark:border-gray-800">
                  <p className="text-gray-400">No hay extras configurados aún.</p>
                </div>
              ) : (
                extrasActual.map((extra) => (
                  <div key={extra.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50 sm:flex-row sm:items-end transition-all">

                    {/* Selector de Insumo */}
                    <div className="flex-1">
                      <Label className="text-xs mb-1">Insumo del Extra</Label>
                      <Select
                        options={extrasOptions}
                        placeholder={"Seleccionar Item"}
                        defaultValue={extra.itemId}
                        onChange={(val) => handleUpdateExtra(extra.id, "itemId", val)}
                        className="dark:bg-gray-900"
                      />
                    </div>

                    {/* Campo Cantidad */}
                    <div className="w-full sm:w-28">
                      <Label className="text-xs mb-1">Cantidad</Label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="0.00"
                        value={extra.cantidad}
                        onChange={(e) => handleUpdateExtra(extra.id, "cantidad", e.target.value)}
                      />
                    </div>

                    {/* Campo Precio */}
                    <div className="w-full sm:w-28">
                      <Label className="text-xs mb-1">Precio (Bs)</Label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        placeholder="0.00"
                        value={extra.precio}
                        onChange={(e) => handleUpdateExtra(extra.id, "precio", e.target.value)}
                      />
                    </div>

                    {/* Botón Eliminar Fila */}
                    <button
                      type="button"
                      onClick={() => handleRemoveExtra(extra.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 dark:border-red-900/30 dark:hover:bg-red-900/20 transition-colors"
                      title="Eliminar extra"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer del Modal */}
            <div className="mt-4 flex items-center justify-end gap-3 px-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={closeExtrasModal}
                disabled={isSavingExtras}
              >
                Cancelar
              </Button>
              <Button size="sm" disabled={isSavingExtras} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSavingExtras ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
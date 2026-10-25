"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { useModal } from "@/hooks/useModal";
import { Modal } from "../modal";
import Button from "../button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Badge from "@/components/ui/badge/Badge";
import { PencilIcon } from "@/icons/index";

// --- Interfaces ---
interface InventoryItem {
  id: number;
  nombre: string;
  precio: string;
  estado: string;
  categoria: string;
  descripcion: string;
  fotoUrl?: string;
}

// Tipo para el payload de actualización (igual que en UserMetaCard)
type UpdatePayload = Partial<InventoryItem> & { id: number };

interface InventoryItemCardProps {
  itemData: InventoryItem;
  onSaved?: (updatedItem: InventoryItem) => void;
}

export default function ProductosCard({ itemData, onSaved }: InventoryItemCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [isSaving, setIsSaving] = useState(false);
  // Agregamos estado de error para mostrar mensajes en el modal como en UserMetaCard
  const [errorMsg, setErrorMsg] = useState<string>("");

  // ---- API helpers (Estilo UserMetaCard) ----
  const updateProduct = useCallback(async (payload: UpdatePayload) => {
    const res = await fetch('/api/inventarios/productos/editar', {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  }, []);

  // ---- Form helpers (Estilo UserMetaCard) ----
  const getFormValues = (form: HTMLFormElement): UpdatePayload => {
    const fd = new FormData(form);
    return {
      id: itemData.id,
      nombre: (fd.get("nombre") as string) ?? "",
      categoria: (fd.get("categoria") as string) ?? "",
      precio: (fd.get("precio") as string) ?? "",
      estado: (fd.get("estado") as string) ?? "activo",
      descripcion: (fd.get("descripcion") as string) ?? "",
      // Mantenemos la foto original si no se edita aquí (o agregar lógica de archivo si fuera necesario)
      fotoUrl: itemData.fotoUrl, 
    };
  };

  // ---- Handlers ----
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;

    setErrorMsg("");
    setIsSaving(true);

    try {
      const payload = getFormValues(e.currentTarget);
      const res = await updateProduct(payload);

      if (!res.ok) {
        const text = await res.json().catch(() => ({}));
        console.error("Error al guardar:", text);
        setErrorMsg(text.message || "No se pudo guardar los cambios.");
        return;
      }

      const updatedData = await res.json();
      
      closeModal();
      onSaved?.(updatedData);
      
    } catch (err) {
      console.error("Fallo de red o servidor:", err);
      setErrorMsg("Ocurrió un problema de red o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- UI Components Helpers ----
  const StatusBadge = ({ estado }: { estado: string }) => {
    const isActive = estado.toLowerCase() === 'activo';
    return (
      <Badge variant="light" color={isActive ? "success" : "error"}>
        {isActive ? "Activo" : "Inactivo"}
      </Badge>
    );
  };

  return (
    <>
      {/* --- TARJETA DEL PRODUCTO --- */}
      <div className="w-full rounded-[20px] border bg-gray-100 dark:bg-gray-dark p-5 dark:border-gray-700">
        
        {/* Encabezado: Imagen + Info */}
        <div className="flex gap-4 mb-4">
          <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-2xl bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            {itemData.fotoUrl ? (
              <Image
                width={84}
                height={84}
                src={itemData.fotoUrl}
                alt={itemData.nombre}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
              </div>
            )}
          </div>

          <div className="flex flex-col pt-2 w-full">
            <h4 className="mb-2 text-[17px] font-bold text-gray-900 dark:text-white leading-tight line-clamp-2">
              {itemData.nombre}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge estado={itemData.estado} />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {itemData.categoria}
              </span>
            </div>
          </div>
        </div>

        {/* Precio */}
        <div className="mb-5 flex items-center text-gray-500 dark:text-gray-400">
          <span className="text-sm font-medium">
            Precio de venta: <span className="text-gray-900 dark:text-white font-bold">Bs. {itemData.precio}</span>
          </span>
        </div>

        {/* Botón Editar */}
        <button
          onClick={openModal}
          className="group flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <PencilIcon className="h-4 w-4" />
          Editar Producto
        </button>
      </div>

      {/* --- MODAL DE EDICIÓN --- */}
      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[700px]">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Editar Información
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Actualice los datos del producto para mantener su información al día.
            </p>
          </div>

          {/* Mensaje de Error (Estilo UserMetaCard) */}
          {errorMsg && (
            <div className="mx-2 mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              {errorMsg}
            </div>
          )}

          <form className="flex flex-col" onSubmit={handleSubmit}>
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90">
                Detalles del Producto
              </h5>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                
                {/* Nombre */}
                <div className="col-span-2">
                  <Label htmlFor="nombre" className="text-black">Nombre</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    type="text"
                    className="text-gray-dark"
                    defaultValue={itemData.nombre}
                  />
                </div>

                {/* Categoría */}
                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="categoria" className="text-black">Categoría</Label>
                  <Input
                    id="categoria"
                    name="categoria"
                    type="text"
                    className="text-gray-dark"
                    defaultValue={itemData.categoria}
                  />
                </div>

                {/* Precio */}
                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="precio" className="text-black">Precio</Label>
                  <Input
                    id="precio"
                    name="precio"
                    type="number"
                    className="text-gray-dark"
                    defaultValue={itemData.precio}
                  />
                </div>

                {/* Estado */}
                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="estado" className="text-black">Estado</Label>
                  <div className="relative">
                    <select
                      id="estado"
                      name="estado"
                      className="w-full rounded-lg border border-stroke bg-transparent py-4 pl-6 pr-10 outline-none focus:border-primary focus-visible:shadow-none dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                      defaultValue={itemData.estado.toLowerCase()}
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>

                {/* Descripción */}
                <div className="col-span-2">
                  <Label htmlFor="descripcion" className="text-black">Descripción</Label>
                  <Input
                    id="descripcion"
                    name="descripcion"
                    type="text"
                    className="text-gray-dark"
                    defaultValue={itemData.descripcion}
                  />
                </div>

              </div>
            </div>

            {/* Footer del Modal */}
            <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={closeModal}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button size="sm" disabled={isSaving} >
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
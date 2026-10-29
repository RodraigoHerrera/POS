"use client";

import React, { useState, useCallback } from "react";
import { ImageOff, Pencil } from "lucide-react";
import { useModal } from "@/hooks/useModal";
import { Modal } from "../modal";
import Button from "../button/Button";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Badge from "@/components/ui/badge/Badge";
import { esProductoActivo } from "@/lib/menuAdmin";

export interface ProductoMenu {
  id: number;
  nombre: string;
  precio: string;
  estado: string;
  categoria: string;
  descripcion: string;
  imagenUrl?: string | null;
}

type FormState = {
  nombre: string;
  categoria: string;
  precio: string;
  estado: "activo" | "inactivo";
  descripcion: string;
};

interface ProductosCardProps {
  itemData: ProductoMenu;
  // Id del <datalist> con las categorías existentes (lo renderiza la página).
  categoriasListId?: string;
  onSaved?: () => void;
}

const formInicial = (p: ProductoMenu): FormState => ({
  nombre: p.nombre ?? "",
  categoria: p.categoria ?? "",
  precio: p.precio ?? "",
  estado: esProductoActivo(p.estado) ? "activo" : "inactivo",
  descripcion: p.descripcion ?? "",
});

export const formatearPrecio = (precio: string) => {
  const n = Number(precio);
  return Number.isFinite(n) ? n.toFixed(2) : precio;
};

export default function ProductosCard({ itemData, categoriasListId, onSaved }: ProductosCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [form, setForm] = useState<FormState>(() => formInicial(itemData));
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toggleError, setToggleError] = useState("");

  const activo = esProductoActivo(itemData.estado);

  const updateProduct = useCallback(
    async (datos: FormState) => {
      const res = await fetch("/api/inventarios/productos/editar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemData.id, ...datos }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "No se pudieron guardar los cambios.");
      }
    },
    [itemData.id]
  );

  // ---- Handlers ----
  const abrirEdicion = () => {
    setForm(formInicial(itemData));
    setErrorMsg("");
    openModal();
  };

  const actualizarCampo =
    (campo: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;

    if (!form.nombre.trim()) {
      setErrorMsg("El nombre es obligatorio.");
      return;
    }
    const precio = Number(form.precio);
    if (form.precio === "" || !Number.isFinite(precio) || precio < 0) {
      setErrorMsg("Ingrese un precio válido (0 o mayor).");
      return;
    }

    setErrorMsg("");
    setIsSaving(true);
    try {
      await updateProduct({ ...form, nombre: form.nombre.trim(), categoria: form.categoria.trim() });
      closeModal();
      onSaved?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ocurrió un problema de red o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  // Mostrar u ocultar en caja sin abrir el formulario.
  const handleToggleEstado = async () => {
    if (isToggling) return;
    setToggleError("");
    setIsToggling(true);
    try {
      await updateProduct({ ...formInicial(itemData), estado: activo ? "inactivo" : "activo" });
      onSaved?.();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <>
      <div
        className={`rounded-2xl border border-gray-200 p-4 transition-colors dark:border-gray-800 sm:p-5 ${
          activo ? "bg-white dark:bg-white/[0.03]" : "bg-gray-50 dark:bg-white/[0.01]"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Foto + nombre */}
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800 ${
                activo ? "" : "opacity-60 grayscale"
              }`}
            >
              {itemData.imagenUrl ? (
                // <img> y no next/image: no hay remotePatterns configurados (igual que en caja)
                // eslint-disable-next-line @next/next/no-img-element
                <img src={itemData.imagenUrl} alt={itemData.nombre} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
                  <ImageOff className="h-6 w-6" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h4 className="truncate font-semibold text-gray-800 dark:text-white/90">{itemData.nombre}</h4>
              <p className="mt-0.5 truncate text-theme-sm text-gray-500 dark:text-gray-400">
                {itemData.categoria?.trim() || "Sin categoría"}
              </p>
              <div className="mt-1.5">
                <Badge size="sm" variant="light" color={activo ? "success" : "light"}>
                  {activo ? "Visible en caja" : "Oculto en caja"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Precio + acciones */}
          <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-4 dark:border-gray-800 sm:border-0 sm:pt-0">
            <div className="sm:w-32 sm:text-right">
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">Precio</p>
              <p className="text-lg font-bold text-gray-800 dark:text-white/90">
                Bs. {formatearPrecio(itemData.precio)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={activo}
                aria-label={activo ? `Ocultar ${itemData.nombre} en caja` : `Mostrar ${itemData.nombre} en caja`}
                title={activo ? "Ocultar en caja" : "Mostrar en caja"}
                onClick={handleToggleEstado}
                disabled={isToggling}
                className={`relative h-6 w-11 shrink-0 rounded-full transition duration-150 ease-linear focus:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-wait disabled:opacity-60 ${
                  activo ? "bg-brand-500" : "bg-gray-200 dark:bg-white/10"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-theme-sm transition-transform duration-150 ease-linear ${
                    activo ? "translate-x-full" : "translate-x-0"
                  }`}
                />
              </button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={abrirEdicion}
                startIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
              >
                Editar
              </Button>
            </div>
          </div>
        </div>

        {toggleError && (
          <p role="alert" className="mt-3 text-theme-xs text-error-600 dark:text-error-400">
            {toggleError}
          </p>
        )}
      </div>

      {/* --- MODAL DE EDICIÓN --- */}
      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[700px]">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Editar producto</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Los cambios se reflejan de inmediato en la pantalla de caja.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mx-2 mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            >
              {errorMsg}
            </div>
          )}

          <form className="flex flex-col" onSubmit={handleSubmit} noValidate>
            <div className="custom-scrollbar max-h-[450px] overflow-y-auto px-2 pb-3">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2">
                  <Label htmlFor={`nombre-${itemData.id}`}>Nombre</Label>
                  <Input
                    id={`nombre-${itemData.id}`}
                    type="text"
                    required
                    value={form.nombre}
                    onChange={actualizarCampo("nombre")}
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor={`categoria-${itemData.id}`}>Categoría</Label>
                  <Input
                    id={`categoria-${itemData.id}`}
                    type="text"
                    list={categoriasListId}
                    placeholder="Ej. Hamburguesas"
                    value={form.categoria}
                    onChange={actualizarCampo("categoria")}
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor={`precio-${itemData.id}`}>Precio de venta</Label>
                  <div className="flex items-stretch gap-2">
                    <span className="flex h-11 shrink-0 items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-white/5 dark:text-gray-400">
                      Bs.
                    </span>
                    <div className="flex-1">
                      <Input
                        id={`precio-${itemData.id}`}
                        type="number"
                        min="0"
                        step={0.01}
                        required
                        value={form.precio}
                        onChange={actualizarCampo("precio")}
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor={`estado-${itemData.id}`}>Disponibilidad</Label>
                  <select
                    id={`estado-${itemData.id}`}
                    value={form.estado}
                    onChange={actualizarCampo("estado")}
                    className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  >
                    <option value="activo">Activo — se muestra en caja</option>
                    <option value="inactivo">Inactivo — oculto en caja</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <Label>Descripción</Label>
                  <TextArea
                    rows={3}
                    placeholder="Ingredientes o detalle visible para el cajero"
                    value={form.descripcion}
                    onChange={(valor) => setForm((prev) => ({ ...prev, descripcion: valor }))}
                    className="text-gray-800!"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
              <Button type="button" size="sm" variant="outline" onClick={closeModal} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

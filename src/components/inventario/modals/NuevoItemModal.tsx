// components/inventario/modals/NuevoItemModal.tsx
"use client";

import { useState, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";

type Option = { value: string; label: string };

type FormState = {
  nombre: string;
  sku: string;
  tipo: string;         // enum prisma (ej. "vendible" | "insumo" | "preparacion" | "oficina")
  unidad_code: string;  // "unidad" | "caja" | ...
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  categoriasOptions: Option[];
  unidadesOptions: Option[];
  onCreated?: () => void; // callback para refrescar padre
};

export default function NuevoItemModal({
  isOpen,
  onClose,
  categoriasOptions,
  unidadesOptions,
  onCreated,
}: Props) {
  const [form, setForm] = useState<FormState>({
    nombre: "",
    sku: "",
    tipo: "",
    unidad_code: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si tu <Select> devuelve el string directamente, esto va bien.
  // Si devuelve {label,value}, ajusta a (opt) => setForm(...opt.value)
  const handleSelectCategoria = (value: string) =>
    setForm((p) => ({ ...p, tipo: mapCategoriaToEnum(value) }));

  const handleSelectUnidad = (value: string) =>
    setForm((p) => ({ ...p, unidad_code: value }));

  const handleText =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const mapCategoriaToEnum = useCallback((uiValue: string) => {
    const map: Record<string, string> = {
      vendible: "vendible",
      insumo: "insumo",
      prep: "prep",
      oficina: "oficina",
    };
    return map[uiValue] ?? uiValue.toUpperCase();
  }, []);

  const resetAndClose = () => {
    setForm({ nombre: "", sku: "", tipo: "", unidad_code: "" });
    onClose();
  };

  const submit = async () => {
    if (!form.nombre || !form.tipo || !form.unidad_code) {
      window.alert("Completa Nombre, Categoría y Unidad de Medida.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/inventarios/agregarItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          sku: form.sku.trim() || null,
          tipo: form.tipo,
          unidad_code: form.unidad_code,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo crear el item");
      }

      // éxito
      resetAndClose();
      onCreated?.();
    } catch (err: any) {
      console.error("Error al crear item:", err);
      window.alert(err?.message || "Error al crear item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[800px] m-4">
      <div className="no-scrollbar relative w-full max-w-[800px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Registrar Nuevo Item
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Complete la información para agregar un nuevo item al inventario.
          </p>
        </div>

        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
          <div className="custom-scrollbar h-[550px] overflow-y-auto px-2 pb-3">
            <div className="mt-7">
              <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                Información del Item
              </h5>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2">
                  <Label className="text-black">Nombre del Item</Label>
                  <Input
                    className="text-gray-dark"
                    type="text"
                    placeholder="Ingrese nombre completo"
                    value={form.nombre}
                    onChange={handleText("nombre")}
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Código (SKU)</Label>
                  <Input
                    className="text-gray-dark"
                    type="text"
                    placeholder="Código único"
                    value={form.sku}
                    onChange={handleText("sku")}
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Categoría</Label>
                  <Select
                    options={categoriasOptions}
                    placeholder="Seleccionar categoría"
                    onChange={handleSelectCategoria}
                    className="dark:bg-dark-900"
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Unidad de Medida</Label>
                  <Select
                    options={unidadesOptions}
                    placeholder="Seleccionar unidad"
                    onChange={handleSelectUnidad}
                    className="dark:bg-dark-900"
                  />
                </div>

              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button size="sm" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Registrar Item"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

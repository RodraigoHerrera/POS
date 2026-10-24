"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import { opcionesUnidad } from "@/lib/unidad";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  item: any; // El item a editar
  onSaved?: () => void;
};

export default function EditarItemModal({
  isOpen,
  onClose,
  item,
  onSaved,
}: Props) {
  const [form, setForm] = useState({
    nombre: "",
    sku: "",
    unidad_code: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setForm({
        nombre: item.nombre || "",
        sku: item.sku || "",
        unidad_code: item.unidad_code || "",
      });
    }
  }, [item]);

  // Derived from the item's original code so a legacy unit stays selectable.
  const opciones = useMemo(
    () => opcionesUnidad(item?.unidad_code),
    [item?.unidad_code]
  );

  const handleText =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async () => {
    if (!form.nombre || !form.unidad_code) {
      window.alert("Nombre y Unidad son obligatorios.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/inventarios/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo actualizar el item");
      }

      toast.success('Operación exitosa');
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error("Error al actualizar item:", err);
      window.alert(err?.message || "Error al actualizar item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[600px] m-4">
      <div className="no-scrollbar relative w-full max-w-[600px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Editar Item
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Modifique los datos permitidos del item.
          </p>
        </div>

        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
          <div className="custom-scrollbar max-h-[60vh] overflow-y-auto px-2 pb-3">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
              <div className="col-span-2">
                <Label className="text-black">Nombre del Item</Label>
                <Input
                  className="text-gray-dark"
                  type="text"
                  value={form.nombre}
                  onChange={handleText("nombre")}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label className="text-black">Código (SKU)</Label>
                <Input
                  className="text-gray-dark"
                  type="text"
                  value={form.sku}
                  onChange={handleText("sku")}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label className="text-black">Unidad de Medida</Label>
                <Select
                  value={form.unidad_code}
                  options={opciones}
                  placeholder="Seleccione una unidad"
                  onChange={(v) => setForm((p) => ({ ...p, unidad_code: v }))}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Solo se guardará si el ítem no tiene historial.
                </p>
              </div>

              <div className="col-span-2">
                <Label className="text-black text-gray-400">Tipo (No editable)</Label>
                <Input
                  className="text-gray-400 bg-gray-100 cursor-not-allowed"
                  type="text"
                  value={item?.tipo || ""}
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button size="sm" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

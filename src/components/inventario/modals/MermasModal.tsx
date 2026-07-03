// components/inventario/modals/MermasModal.tsx
"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";

type Option = { value: string; label: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function MermasModal({ isOpen, onClose, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsItems, setOptionsItems] = useState<Option[]>([]);
  const [payload, setPayload] = useState({
    item: "",
    lote: "",
    cantidad: "",
    fecha: "",
    tipoMerma: "",
    motivo: "",
  });

  // Cargar insumos/prep reales (las mermas no aplican a items vendibles)
  useEffect(() => {
    if (!isOpen) return;
    const fetchItems = async () => {
      try {
        const res = await fetch("/api/inventarios/items");
        if (res.ok) {
          const data = await res.json();
          setOptionsItems(
            data
              .filter((i: any) => i.tipo !== "vendible")
              .map((i: any) => ({ value: String(i.id), label: `${i.nombre} (${i.unidad_code || "u"})` }))
          );
        }
      } catch (err) {
        console.error("Error cargando items para mermas:", err);
      }
    };
    fetchItems();
  }, [isOpen]);

  const handleText =
    (key: keyof typeof payload) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setPayload((p) => ({ ...p, [key]: e.target.value }));

  const handleSelectItem = (val: string) => setPayload((p) => ({ ...p, item: val }));
  const handleSelectTipo = (val: string) => setPayload((p) => ({ ...p, tipoMerma: val }));

  const save = async () => {
    setError(null);
    if (!payload.item || !payload.cantidad || !payload.tipoMerma) {
      setError("Completa Item, Cantidad y Tipo de Merma.");
      return;
    }
    try {
      setIsSaving(true);
      const res = await fetch("/api/inventarios/mermas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: payload.item,
          cantidad: Number(payload.cantidad),
          tipoMerma: payload.tipoMerma,
          motivo: payload.motivo || undefined,
          loteReferencia: payload.lote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "No se pudo registrar la merma");
        return;
      }
      setPayload({ item: "", lote: "", cantidad: "", fecha: "", tipoMerma: "", motivo: "" });
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Error registrando merma:", err);
      setError("Error de red al registrar la merma");
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[700px] m-4">
      <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Registrar mermas
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Formulario para registrar pérdidas o mermas de items.
          </p>
        </div>

        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
          <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
            <div className="mt-7">
              <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                Información de Mermas
              </h5>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Item</Label>
                  <Select
                    options={optionsItems}
                    placeholder="Seleccionar Item"
                    onChange={handleSelectItem}
                    className="dark:bg-dark-900"
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Cantidad Perdida</Label>
                  <Input className="text-gray-dark" type="number" placeholder="Cantidad" onChange={handleText("cantidad")} />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Referencia de lote (opcional)</Label>
                  <Input
                    className="text-gray-dark"
                    type="text"
                    placeholder="Ej: código físico del lote"
                    onChange={handleText("lote")}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    El stock se descuenta por FEFO automáticamente; esto es solo una nota.
                  </p>
                </div>

                <div className="col-span-2">
                  <Label className="text-black">Tipo de Merma</Label>
                  <Select
                    options={[
                      { value: "vencimiento", label: "Vencimiento" },
                      { value: "dano", label: "Daño" },
                      { value: "robo", label: "Robo" },
                      { value: "error", label: "Error de registro" },
                    ]}
                    placeholder="Seleccionar tipo"
                    onChange={handleSelectTipo}
                    className="dark:bg-dark-900"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-black">Motivo Detallado</Label>
                  <Input
                    className="text-gray-dark"
                    type="text"
                    placeholder="Describe brevemente el motivo..."
                    onChange={handleText("motivo")}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="mx-2 mb-2 rounded-md bg-error-50 px-3 py-2 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button size="sm" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Registrar Merma"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

// components/inventario/modals/EntradaModal.tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import { CalenderIcon } from "@/icons";

type Option = { value: string; label: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  itemsOptions: Option[];
  onSaved?: () => void;
};

export default function EntradaModal({ isOpen, onClose, itemsOptions, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [payload, setPayload] = useState({
    item: "",
    lote: "",
    cantidad: "",
    fechaVenc: "",
    proveedor: "",
    notas: "",
  });

  const handleText =
    (key: keyof typeof payload) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setPayload((p) => ({ ...p, [key]: e.target.value }));

  const handleSelectItem = (val: string) =>
    setPayload((p) => ({ ...p, item: val }));

  const save = async () => {
    // TODO: pegarle a tu endpoint real /api/inventarios/entrada
    try {
      setIsSaving(true);
      // await fetch(...)
      onSaved?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[700px] m-4">
      <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Registrar entrada de items
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Formulario para registrar nueva entrada de items al inventario.
          </p>
        </div>

        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
          <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
            <div className="mt-7">
              <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                Información de Entrada
              </h5>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Item</Label>
                  <Select
                    options={itemsOptions}
                    placeholder="Seleccionar Item"
                    onChange={handleSelectItem}
                    className="dark:bg-dark-900"
                  />
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Lote</Label>
                  <Input className="text-gray-dark" type="text" placeholder="Número de lote" onChange={handleText("lote")} />
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Cantidad</Label>
                  <Input className="text-gray-dark" type="number" placeholder="Ingrese cantidad" onChange={handleText("cantidad")} />
                </div>
                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Fecha de Vencimiento</Label>
                  <div className="relative">
                    <Input type="date" onChange={handleText("fechaVenc")} />
                    <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                      <CalenderIcon />
                    </span>
                  </div>
                </div>
                <div className="col-span-2 lg:col-span-2">
                  <Label className="text-black">Proveedor</Label>
                  <Input className="text-gray-dark" type="text" placeholder="Nombre del proveedor" onChange={handleText("proveedor")} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button size="sm" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Registrar Entrada"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

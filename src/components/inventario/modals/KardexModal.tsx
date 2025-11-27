// components/inventario/modals/KardexModal.tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";

type Option = { value: string; label: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function KardexModal({ isOpen, onClose}: Props) {
  const [filtros, setFiltros] = useState({
    item: "",
    desde: "",
    hasta: "",
  });

  const handleSelectItem = (val: string) => setFiltros((p) => ({ ...p, item: val }));
  const handleChange =
    (key: keyof typeof filtros) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFiltros((p) => ({ ...p, [key]: e.target.value }));

  const exportar = () => {
    // TODO: Lógica de export (CSV/PDF) contra tu endpoint
    onClose();
  };


    const optionsItems = [
      { value: "item1", label: "Item A" },
      { value: "item2", label: "Item B" },
      { value: "item3", label: "Item C" },
  ];


  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[1000px] m-4">
      <div className="no-scrollbar relative w-full max-w-[1000px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Consultar Kardex
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Consulta el historial completo de movimientos de inventario.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-3">
          <div>
            <Label className="text-black">Seleccionar Item</Label>
            <Select
              options={optionsItems}
              placeholder="Todos los items"
              onChange={handleSelectItem}
              className="dark:bg-dark-900"
            />
          </div>
          <div>
            <Label className="text-black">Fecha Desde</Label>
            <Input className="text-gray-dark" type="date" onChange={handleChange("desde")} />
          </div>
          <div>
            <Label className="text-black">Fecha Hasta</Label>
            <Input className="text-gray-dark" type="date" onChange={handleChange("hasta")} />
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg dark:border-gray-700">
          <div className="p-4 bg-gray-50 dark:bg-gray-800">
            <h5 className="font-semibold text-gray-800 dark:text-white">Movimientos de Inventario</h5>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Fecha</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Item</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Tipo</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Cantidad</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Datos dummy para UI; reemplaza con fetch si deseas */}
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-sm">15/01/2024</td>
                    <td className="px-4 py-3 text-sm">Item A</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full dark:bg-green-900 dark:text-green-200">
                        Entrada
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-green-600">+50</td>
                    <td className="px-4 py-3 text-sm">150</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-sm">18/01/2024</td>
                    <td className="px-4 py-3 text-sm">Item A</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full dark:bg-red-900 dark:text-red-200">
                        Salida
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600">-25</td>
                    <td className="px-4 py-3 text-sm">125</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button size="sm" onClick={exportar}>
            Exportar Reporte
          </Button>
        </div>
      </div>
    </Modal>
  );
}

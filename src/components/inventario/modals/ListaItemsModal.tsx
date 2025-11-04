// components/inventario/modals/ListaItemsModal.tsx
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
  categoriasOptions: Option[];
};

export default function ListaItemsModal({ isOpen, onClose, categoriasOptions }: Props) {
  const [filtros, setFiltros] = useState({ search: "", categoria: "" });

  const handleChangeSearch = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFiltros((p) => ({ ...p, search: e.target.value }));

  const handleSelectCategoria = (val: string) =>
    setFiltros((p) => ({ ...p, categoria: val }));

  const exportar = () => {
    // TODO: export CSV/PDF según tus necesidades
  };

  const actualizar = () => {
    // TODO: refrescar tabla desde backend
    onClose(); // o quítalo si no quieres cerrar
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[1200px] m-4">
      <div className="no-scrollbar relative w-full max-w-[1200px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Lista de Items
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Vista completa de todos los items en inventario.
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <Input
              className="text-gray-dark w-full lg:w-64"
              type="text"
              placeholder="Buscar item..."
              value={filtros.search}
              onChange={handleChangeSearch}
            />
            <Select
              options={categoriasOptions}
              placeholder="Todas las categorías"
              onChange={handleSelectCategoria}
              className="dark:bg-dark-900 w-full lg:w-48"
            />
          </div>
          <Button size="sm" onClick={exportar}>
            Exportar Lista
          </Button>
        </div>

        <div className="border border-gray-200 rounded-lg dark:border-gray-700">
          <div className="p-4 bg-gray-50 dark:bg-gray-800">
            <h5 className="font-semibold text-gray-800 dark:text-white">Inventario Actual</h5>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Código</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Item</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Categoría</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Stock Actual</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Stock Mínimo</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Estado</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Demo rows; reemplaza con datos reales */}
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-sm">MED-001</td>
                    <td className="px-4 py-3 text-sm">Item A</td>
                    <td className="px-4 py-3 text-sm">Medicamento</td>
                    <td className="px-4 py-3 text-sm">125</td>
                    <td className="px-4 py-3 text-sm">20</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full dark:bg-green-900 dark:text-green-200">
                        Normal
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Button variant="outline">Editar</Button>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 text-sm">MAT-002</td>
                    <td className="px-4 py-3 text-sm">Item B</td>
                    <td className="px-4 py-3 text-sm">Material Médico</td>
                    <td className="px-4 py-3 text-sm">15</td>
                    <td className="px-4 py-3 text-sm">25</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full dark:bg-red-900 dark:text-red-200">
                        Bajo
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Button variant="outline">Editar</Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-2 mt-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">Mostrando 2 de 45 items</div>
          <div className="flex gap-3">
            <Button size="sm" variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button size="sm" onClick={actualizar}>
              Actualizar Lista
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { descargarCSV } from "@/lib/csv";
import { construirCSVItems, nombreArchivoItems } from "@/lib/itemsCsv";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import TableRowSkeleton from "@/components/ui/skeleton/TableRowSkeleton";
import EditarItemModal from "./EditarItemModal";

// --- Interfaces basadas en tu Schema ---
interface InventoryItem {
  id: string; // BigInt serializado
  sku: string | null;
  nombre: string;
  tipo: string; // vendible, insumo, prep
  unidad_code: string;
  activo: boolean;
  costo_estandar: string | null;
  inventario?: {
    stock: string;
    stock_min: string;
  };
}

type Option = { value: string; label: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  categoriasOptions: Option[];
};

export default function ListaItemsModal({ isOpen, onClose, categoriasOptions }: Props) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({ search: "", categoria: "" });
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventarios/items?all=true"); 
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setItems(data);
      } else {
        console.error("Formato de respuesta inválido", data);
        setItems([]);
      }
    } catch (error) {
      console.error("Error cargando items:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, fetchItems]);

  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      item.nombre.toLowerCase().includes(filtros.search.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(filtros.search.toLowerCase()));
    
    const matchesCategory = 
      filtros.categoria === "" || item.tipo === filtros.categoria;

    return matchesSearch && matchesCategory;
  });

  const handleChangeSearch = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFiltros((p) => ({ ...p, search: e.target.value }));

  const handleSelectCategoria = (val: string) =>
    setFiltros((p) => ({ ...p, categoria: val }));

  // Exporta lo que se ve en la tabla (busqueda y filtro de tipo incluidos)
  const exportar = () => {
    if (filteredItems.length === 0) {
      toast.error("No hay items para exportar");
      return;
    }
    descargarCSV(construirCSVItems(filteredItems), nombreArchivoItems(new Date()));
  };

  const guardarCostoEstandar = async (itemId: string, valor: string) => {
    const costoEstandar = valor.trim() === "" ? null : Number(valor);
    if (costoEstandar !== null && (Number.isNaN(costoEstandar) || costoEstandar < 0)) {
      alert("El costo estándar debe ser un número válido");
      return;
    }
    try {
      const res = await fetch("/api/inventarios/costoEstandar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, costoEstandar }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "No se pudo guardar el costo estándar");
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, costo_estandar: costoEstandar === null ? null : String(costoEstandar) }
            : it
        )
      );
    } catch (error) {
      console.error("Error guardando costo estándar:", error);
    }
  };

  const handleToggleEstado = async (item: InventoryItem) => {
    const confirmacion = window.confirm(
      `¿Está seguro que desea ${item.activo ? 'desactivar' : 'activar'} el ítem "${item.nombre}"?`
    );
    if (!confirmacion) return;

    try {
      const res = await fetch(`/api/inventarios/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !item.activo }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Error cambiando el estado");
      }

      setItems(prev => prev.map(i => i.id === item.id ? { ...i, activo: !item.activo } : i));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} className="max-w-[1200px] m-4">
        <div className="no-scrollbar relative w-full max-w-[1200px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Catálogo de Items
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Gestión de inventario físico (Ingredientes, Insumos y Productos Vendibles).
            </p>
          </div>

          <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <Input
                className="text-gray-dark w-full lg:w-64"
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={filtros.search}
                onChange={handleChangeSearch}
              />
              <Select
                options={categoriasOptions}
                placeholder="Todas los tipos"
                onChange={handleSelectCategoria}
                className="dark:bg-dark-900 w-full lg:w-48"
              />
            </div>
            <Button size="sm" onClick={exportar} variant="outline">
              Exportar Lista
            </Button>
          </div>

          <div className="border border-gray-200 rounded-lg dark:border-gray-700 overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h5 className="font-semibold text-gray-800 dark:text-white">
                Items ({filteredItems.length})
              </h5>
            </div>
            
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-600">
              <table className="w-full relative">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">SKU / Código</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nombre Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Unidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400" title="Usado en el costeo teórico (BOM). Vacío = usa el costo promedio de compra.">
                      Costo estándar
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} columns={6} />)
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No se encontraron items.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      return (
                        <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${!item.activo ? 'opacity-50 bg-gray-50 dark:bg-gray-800/30' : ''}`}>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                            {item.sku || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white flex items-center gap-2">
                            {item.nombre}
                            {!item.activo && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-200 text-gray-600 rounded-full dark:bg-gray-700 dark:text-gray-300">
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 capitalize">
                            {item.tipo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {item.unidad_code}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              defaultValue={item.costo_estandar ?? ""}
                              placeholder="auto"
                              onBlur={(e) => {
                                if (e.target.value === (item.costo_estandar ?? "")) return;
                                guardarCostoEstandar(item.id, e.target.value);
                              }}
                              className="w-24 rounded-md border border-gray-300 bg-white px-2 py-1 text-right text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              disabled={!item.activo}
                            />
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => setItemToEdit(item)}
                              className="text-brand-500 hover:text-brand-600 text-sm font-medium"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleToggleEstado(item)}
                              className={`${item.activo ? 'text-error-500 hover:text-error-600' : 'text-green-600 hover:text-green-700'} text-sm font-medium`}
                            >
                              {item.activo ? "Desactivar" : "Activar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={fetchItems}>
              Refrescar Datos
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de edición */}
      {itemToEdit && (
        <EditarItemModal
          isOpen={!!itemToEdit}
          onClose={() => setItemToEdit(null)}
          item={itemToEdit}
          onSaved={() => {
            fetchItems();
          }}
        />
      )}
    </>
  );
}
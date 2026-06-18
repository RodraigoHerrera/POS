"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import TableRowSkeleton from "@/components/ui/skeleton/TableRowSkeleton";

// --- Interfaces ---
interface KardexMovement {
  id: string;
  fecha: string;
  item: string;
  sku: string;
  unidad: string;
  tipo: string; // "Entrada", "Salida"
  motivo: string;
  referencia: string;
  cantidad: number;
  costo_unitario: number;
  total_movimiento: string;
  lote: string;
  vencimiento: string;
}

type Option = { value: string; label: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  // Opcional: Si quieres pasar la lista de items desde el padre para el select
  itemsOptions?: Option[]; 
};

export default function KardexModal({ isOpen, onClose, itemsOptions = [] }: Props) {
  // --- Estados ---
  const [movimientos, setMovimientos] = useState<KardexMovement[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [filtros, setFiltros] = useState({
    item: "",
    desde: "",
    hasta: "",
  });

  // --- Carga de Datos ---
  const fetchKardex = useCallback(async () => {
    try {
      setLoading(true);
      
      // Construir URL con parámetros
      const params = new URLSearchParams();
      if (filtros.item) params.append("itemId", filtros.item);
      // Nota: El endpoint actual no filtra por fechas nativamente, 
      // pero podríamos implementarlo o filtrar en el frontend.
      params.append("limit", "50"); // Traer últimos 50 movimientos

      const res = await fetch(`/api/inventarios/kardex?${params.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        setMovimientos(data.data);
      } else {
        setMovimientos([]);
      }
    } catch (error) {
      console.error("Error cargando kardex:", error);
    } finally {
      setLoading(false);
    }
  }, [filtros.item]); // Se recarga si cambia el item seleccionado

  // Cargar al abrir
  useEffect(() => {
    if (isOpen) {
      fetchKardex();
    }
  }, [isOpen, fetchKardex]);

  // --- Filtrado Frontend por Fechas (Opcional si el backend no lo soporta aún) ---
  const movimientosFiltrados = movimientos.filter((mov) => {
    if (!filtros.desde && !filtros.hasta) return true;
    const fechaMov = new Date(mov.fecha).getTime();
    const desde = filtros.desde ? new Date(filtros.desde).getTime() : 0;
    const hasta = filtros.hasta ? new Date(filtros.hasta).getTime() + 86400000 : Infinity; // +1 día para incluir el final
    return fechaMov >= desde && fechaMov <= hasta;
  });

  // --- Handlers ---
  const handleSelectItem = (val: string) => setFiltros((p) => ({ ...p, item: val }));
  
  const handleChange = (key: keyof typeof filtros) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFiltros((p) => ({ ...p, [key]: e.target.value }));

  const exportar = () => {
    console.log("Exportando:", movimientosFiltrados);
    alert("Generando reporte PDF...");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[1100px] m-4">
      <div className="no-scrollbar relative w-full max-w-[1100px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        
        {/* Encabezado */}
        <div className="px-2 pr-14 mb-6">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Kardex de Inventario
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Historial de movimientos (Entradas) registrados en esta sucursal.
          </p>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-4 items-end">
          <div className="lg:col-span-1">
            <Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Filtrar por Item
            </Label>
            <Select
              options={itemsOptions}
              placeholder="Todos los items"
              onChange={handleSelectItem}
              className="dark:bg-gray-800 w-full"
            />
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Desde
            </Label>
            <Input 
              type="date" 
              value={filtros.desde}
              onChange={handleChange("desde")} 
              className="dark:bg-gray-800"
            />
          </div>
          <div>
            <Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Hasta
            </Label>
            <Input 
              type="date" 
              value={filtros.hasta}
              onChange={handleChange("hasta")} 
              className="dark:bg-gray-800"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchKardex} className="w-full">
              Buscar
            </Button>
            <Button variant="outline" onClick={exportar} className="w-full">
              Exportar
            </Button>
          </div>
        </div>

        {/* Tabla */}
        <div className="border border-gray-200 rounded-lg dark:border-gray-700 overflow-hidden">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h5 className="font-semibold text-gray-800 dark:text-white">
              Movimientos Recientes ({movimientosFiltrados.length})
            </h5>
            {loading && <span className="text-xs text-blue-500 animate-pulse">Actualizando...</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Detalle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Lote</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Cantidad</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Costo Unit.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {loading && movimientosFiltrados.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} columns={7} />)
                ) : movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No se encontraron movimientos registrados.
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((mov) => (
                    <tr key={mov.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {new Date(mov.fecha).toLocaleDateString()} <span className="text-xs text-gray-400">{new Date(mov.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 dark:text-white">
                        {mov.item}
                        <div className="text-xs text-gray-400 font-normal">{mov.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          mov.tipo === 'Entrada' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800'
                        }`}>
                          {mov.tipo}
                        </span>
                        <div className="text-xs text-gray-500 mt-0.5">{mov.motivo}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {mov.lote}
                        {mov.vencimiento !== 'N/A' && <div className="text-xs text-gray-400">Vence: {mov.vencimiento}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-700 dark:text-gray-200">
                        {mov.tipo === 'Entrada' ? '+' : '-'}{mov.cantidad} <span className="text-xs font-normal text-gray-500">{mov.unidad}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                        {mov.costo_unitario.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-800 dark:text-white">
                        {mov.total_movimiento}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
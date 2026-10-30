"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import DatePicker from "@/components/form/date-picker";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import TableRowSkeleton from "@/components/ui/skeleton/TableRowSkeleton";
import { formatCostoUnitario } from "@/lib/costo";
import { mensajeErrorApi } from "@/lib/respuestaApi";
import { construirCSVKardex, nombreArchivoKardex } from "@/lib/kardexCsv";
import { rangoDesdeSeleccion } from "@/lib/rangoFechas";
import EditarEntradaForm from "./EditarEntradaForm";

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
  empleado: string;
  cantidad: number;
  costo_unitario: number;
  total_movimiento: string;
  lote: string;
  vencimiento: string;
  referencia_original: string | null;
  fecha_caducidad: string | null;
  editable: boolean;
  cantidad_costo_editables: boolean;
  anulado: boolean;
  anulable: boolean;
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
  const [editando, setEditando] = useState<KardexMovement | null>(null);
  const [anulando, setAnulando] = useState<KardexMovement | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [isAnulando, setIsAnulando] = useState(false);
  
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
    // "T00:00:00" fuerza medianoche local: "YYYY-MM-DD" a secas se interpreta como UTC
    const desde = filtros.desde ? new Date(`${filtros.desde}T00:00:00`).getTime() : 0;
    const hasta = filtros.hasta ? new Date(`${filtros.hasta}T00:00:00`).getTime() + 86400000 : Infinity; // +1 día para incluir el final
    return fechaMov >= desde && fechaMov <= hasta;
  });

  // --- Handlers ---
  const handleSelectItem = (val: string) => setFiltros((p) => ({ ...p, item: val }));
  
  // Un rango a medio elegir (una sola fecha) no filtra hasta completar el segundo clic
  const handleRango = (fechas: Date[]) => {
    const r = rangoDesdeSeleccion(fechas);
    if (r) setFiltros((p) => ({ ...p, ...r }));
  };

  // Exporta lo que se ve en la tabla (filtro de item y fechas incluido)
  const exportar = () => {
    if (movimientosFiltrados.length === 0) {
      toast.error("No hay movimientos para exportar");
      return;
    }
    const csv = construirCSVKardex(movimientosFiltrados);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivoKardex(new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const cancelarAnulacion = () => {
    setAnulando(null);
    setMotivoAnulacion("");
  };

  const confirmarAnulacion = async () => {
    if (!anulando) return;
    try {
      setIsAnulando(true);
      const res = await fetch(`/api/inventarios/entradas/${anulando.id}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivoAnulacion }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(mensajeErrorApi(data, "No se pudo anular la entrada"));
        return;
      }
      toast.success("Entrada anulada");
      cancelarAnulacion();
      fetchKardex();
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión al anular la entrada");
    } finally {
      setIsAnulando(false);
    }
  };

  // Al cerrar se descarta la edición o anulación en curso para reabrir siempre en la tabla
  const handleClose = () => {
    setEditando(null);
    cancelarAnulacion();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[1100px] m-4">
      <div className="no-scrollbar relative w-full max-w-[1100px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        {editando ? (
          <EditarEntradaForm
            key={editando.id}
            entrada={editando}
            onCancel={() => setEditando(null)}
            onSaved={() => {
              setEditando(null);
              fetchKardex();
            }}
          />
        ) : anulando ? (
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Anular entrada
          </h4>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            Se anulará la entrada de{" "}
            <span className="font-medium">
              {anulando.cantidad} {anulando.unidad}
            </span>{" "}
            de <span className="font-medium">{anulando.item}</span> (lote {anulando.lote}). El
            stock y el costo promedio se revertirán, pero el movimiento seguirá visible en el
            kardex como anulado. Esta acción no se puede deshacer.
          </p>
          <Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Motivo (opcional)
          </Label>
          <textarea
            value={motivoAnulacion}
            onChange={(e) => setMotivoAnulacion(e.target.value)}
            maxLength={255}
            rows={3}
            disabled={isAnulando}
            placeholder="Ej. Error de digitación"
            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={cancelarAnulacion} disabled={isAnulando}>
              Cancelar
            </Button>
            <Button onClick={confirmarAnulacion} disabled={isAnulando}>
              {isAnulando ? "Anulando..." : "Confirmar anulación"}
            </Button>
          </div>
        </div>
        ) : (
        <>
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
          <div className="lg:col-span-2">
            <Label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Periodo
            </Label>
            <DatePicker
              id="kardex-periodo"
              mode="range"
              placeholder="Todas las fechas"
              value={[filtros.desde, filtros.hasta]}
              onChange={handleRango}
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
          
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-600">
            <table className="w-full relative">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10 shadow-sm">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Detalle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Lote</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Registrado por</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Cantidad</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Costo Unit.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {loading && movimientosFiltrados.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} columns={9} />)
                ) : movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No se encontraron movimientos registrados.
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((mov) => (
                    <tr
                      key={mov.id}
                      className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${mov.anulado ? "line-through text-gray-400 dark:text-gray-500" : ""}`}
                    >
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
                        {mov.anulado && (
                          <span className="mt-1 inline-flex items-center rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 no-underline dark:bg-gray-700 dark:text-gray-200">
                            Anulada
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {mov.lote}
                        {mov.vencimiento !== 'N/A' && <div className="text-xs text-gray-400">Vence: {mov.vencimiento}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {mov.empleado}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-700 dark:text-gray-200">
                        {mov.tipo === 'Entrada' ? '+' : '-'}{mov.cantidad} <span className="text-xs font-normal text-gray-500">{mov.unidad}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-300">
                        {formatCostoUnitario(mov.costo_unitario)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-800 dark:text-white">
                        {mov.total_movimiento}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex justify-end gap-2">
                          {mov.editable && (
                            <Button size="sm" variant="outline" onClick={() => setEditando(mov)}>
                              Editar
                            </Button>
                          )}
                          {mov.anulable && (
                            <Button size="sm" variant="outline" onClick={() => setAnulando(mov)}>
                              Anular
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
        </>
        )}
      </div>
    </Modal>
  );
}
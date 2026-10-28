"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Badge from "@/components/ui/badge/Badge";
import { DownloadIcon, FileIcon } from "@/icons";

interface FilaDetalle {
  fila: number;
  identificador: string;
  nombre: string;
  estado: "creado" | "actualizado" | "error";
  errores?: string[];
}

interface ReporteCarga {
  totalFilas: number;
  creados: number;
  actualizados: number;
  fallidos: number;
  detalles: FilaDetalle[];
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function CargaMasivaModal({ isOpen, onClose, onSaved }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [reporte, setReporte] = useState<ReporteCarga | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "errores" | "exitosos">("todos");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModal = () => {
    setArchivo(null);
    setReporte(null);
    setFiltroEstado("todos");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleDescargarPlantilla = async () => {
    try {
      setDescargando(true);
      const res = await fetch("/api/inventarios/items/plantilla-csv");
      if (!res.ok) throw new Error("Error al descargar plantilla");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla_items.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Plantilla CSV descargada con éxito");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo descargar la plantilla");
    } finally {
      setDescargando(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const f = files[0];
      if (!f.name.toLowerCase().endsWith(".csv")) {
        toast.error("Por favor selecciona un archivo con extensión .csv");
        return;
      }
      setArchivo(f);
      setReporte(null);
    }
  };

  const handleSubirCSV = async () => {
    if (!archivo) {
      toast.error("Debes seleccionar un archivo CSV para subir.");
      return;
    }

    try {
      setProcesando(true);
      const formData = new FormData();
      formData.append("file", archivo);

      const res = await fetch("/api/inventarios/items/carga-masiva", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Error al procesar el archivo CSV.");
        return;
      }

      setReporte(data.reporte);
      toast.success("Proceso de importación masiva finalizado.");
      if (onSaved) {
        onSaved();
      }
    } catch (error: unknown) {
      console.error("Error en carga masiva:", error);
      toast.error("Ocurrió un error inesperado al procesar el archivo.");
    } finally {
      setProcesando(false);
    }
  };

  const detallesFiltrados = (reporte?.detalles || []).filter((d) => {
    if (filtroEstado === "errores") return d.estado === "error";
    if (filtroEstado === "exitosos") return d.estado === "creado" || d.estado === "actualizado";
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-4xl p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-6">
        {/* Cabecera */}
        <div className="border-b border-gray-200 dark:border-gray-800 pb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Carga Masiva de Items (Upsert CSV)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Importa o actualiza masivamente ítems del inventario mediante una plantilla CSV codificada en UTF-8.
          </p>
        </div>

        {/* Sección de Instrucciones y Descarga */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Paso 1: Descarga la plantilla oficial
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Contiene las cabeceras requeridas. Deja <code className="text-brand-500 font-mono">id</code> vacío para nuevos ítems o indícalo para actualizar existentes.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            startIcon={<DownloadIcon className="w-4 h-4" />}
            onClick={handleDescargarPlantilla}
            disabled={descargando}
          >
            {descargando ? "Descargando..." : "Descargar Plantilla CSV"}
          </Button>
        </div>

        {/* Sección de Subida de Archivo */}
        <div className="p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-white/2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Paso 2: Selecciona y procesa tu archivo CSV
          </h3>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={procesando}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 dark:file:bg-brand-500/20 dark:file:text-brand-400 cursor-pointer"
            />
            <Button
              size="sm"
              variant="primary"
              onClick={handleSubirCSV}
              disabled={!archivo || procesando}
              className="w-full sm:w-auto shrink-0"
            >
              {procesando ? "Procesando Upsert..." : "Cargar y Ejecutar"}
            </Button>
          </div>
          {archivo && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
              <FileIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>{archivo.name}</span>
              <span className="text-gray-400">({(archivo.size / 1024).toFixed(1)} KB)</span>
            </p>
          )}
        </div>

        {/* Reporte de Validación Fila por Fila */}
        {reporte && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Total Filas</span>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{reporte.totalFilas}</p>
              </div>
              <div className="p-3 rounded-lg border border-success-200 dark:border-success-500/20 bg-success-50/30 dark:bg-success-500/5">
                <span className="text-xs text-success-700 dark:text-success-400">Creados (Insert)</span>
                <p className="text-lg font-bold text-success-700 dark:text-success-400">{reporte.creados}</p>
              </div>
              <div className="p-3 rounded-lg border border-brand-200 dark:border-brand-500/20 bg-brand-50/30 dark:bg-brand-500/5">
                <span className="text-xs text-brand-700 dark:text-brand-400">Actualizados (Update)</span>
                <p className="text-lg font-bold text-brand-700 dark:text-brand-400">{reporte.actualizados}</p>
              </div>
              <div className="p-3 rounded-lg border border-error-200 dark:border-error-500/20 bg-error-50/30 dark:bg-error-500/5">
                <span className="text-xs text-error-700 dark:text-error-400">Fallidos / Errores</span>
                <p className="text-lg font-bold text-error-700 dark:text-error-400">{reporte.fallidos}</p>
              </div>
            </div>

            {/* Pestañas de filtrado del reporte */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-2">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Auditoría Fila por Fila
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFiltroEstado("todos")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    filtroEstado === "todos"
                      ? "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
                >
                  Todos ({reporte.detalles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstado("errores")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    filtroEstado === "errores"
                      ? "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
                >
                  Errores ({reporte.fallidos})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstado("exitosos")}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    filtroEstado === "exitosos"
                      ? "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  }`}
                >
                  Exitosos ({reporte.creados + reporte.actualizados})
                </button>
              </div>
            </div>

            {/* Tabla de detalle */}
            <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-400 sticky top-0 border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Fila</th>
                    <th className="py-2 px-3 font-semibold">Identificador</th>
                    <th className="py-2 px-3 font-semibold">Nombre</th>
                    <th className="py-2 px-3 font-semibold">Estado</th>
                    <th className="py-2 px-3 font-semibold">Diagnóstico / Errores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detallesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-400">
                        No hay registros en este filtro.
                      </td>
                    </tr>
                  ) : (
                    detallesFiltrados.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/2">
                        <td className="py-2 px-3 font-mono font-medium text-gray-600 dark:text-gray-400">
                          #{item.fila}
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">
                          {item.identificador}
                        </td>
                        <td className="py-2 px-3 text-gray-800 dark:text-gray-200 font-medium">
                          {item.nombre}
                        </td>
                        <td className="py-2 px-3">
                          {item.estado === "creado" && (
                            <Badge color="success" size="sm">
                              Creado
                            </Badge>
                          )}
                          {item.estado === "actualizado" && (
                            <Badge color="primary" size="sm">
                              Actualizado
                            </Badge>
                          )}
                          {item.estado === "error" && (
                            <Badge color="error" size="sm">
                              Error
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                          {item.errores && item.errores.length > 0 ? (
                            <ul className="list-disc pl-3 text-error-600 dark:text-error-400 space-y-0.5">
                              {item.errores.map((err, errIdx) => (
                                <li key={errIdx}>{err}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-400">Operación exitosa</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Botón de cierre */}
        <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-800">
          <Button size="sm" variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

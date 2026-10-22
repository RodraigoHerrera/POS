// app/inventario/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import LineChartOne from "@/components/charts/line/LineChartOne";
import StockAlertsCard from "@/components/inventario/StockAlertsCard";
import Button from "@/components/ui/button/Button";
import { PlusIcon, TrashBinIcon, ListIcon, GroupIcon, BoxIcon } from "@/icons";
import { useModal } from "@/hooks/useModal";

// Modales desacoplados
import NuevoItemModal from "@/components/inventario/modals/NuevoItemModal";
import EntradaModal from "@/components/inventario/modals/EntradaModal";
import MermasModal from "@/components/inventario/modals/MermasModal";
import KardexModal from "@/components/inventario/modals/KardexModal";
import ListaItemsModal from "@/components/inventario/modals/ListaItemsModal";
import AlertasModal from "@/components/inventario/modals/AlertasModal";
import ControlStockModal from "@/components/inventario/modals/ControlStockModal";

export default function Inventario() {
  const router = useRouter();

  // Disclosures para cada modal
  const entradaModal = useModal();
  const mermasModal = useModal();
  const kardexModal = useModal();
  const nuevoItemModal = useModal();
  const listaItemsModal = useModal();
  const alertasModal = useModal();
  const controlStockModal = useModal();

  // Item preseleccionado en EntradaModal cuando se llega vía "Reponer" desde StockAlertsCard o ControlStockModal
  const [presetItemId, setPresetItemId] = useState<string | undefined>(undefined);

  // Opciones
  const categoriasOptions = useMemo(
    () => [
      { value: "vendible", label: "Vendible" },
      { value: "insumo", label: "Insumo" },
      { value: "prep", label: "Preparación" },
      { value: "oficina", label: "Oficina" },
    ],
    []
  );

  const unidadesOptions = useMemo(
    () => [
      { value: "unidad", label: "Unidad" },
      { value: "caja", label: "Caja" },
      { value: "paquete", label: "Paquete" },
      { value: "litro", label: "Litro" },
      { value: "kilogramo", label: "Kilogramo" },
    ],
    []
  );

  // Cuando un modal guarda algo -> refrescamos widgets/listas
  const handleDataChanged = () => router.refresh();

  return (
    <>
      <div className="space-y-5">
        {/* Header con Acciones Rápidas */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
          <h1 className="font-bold text-gray-800 text-title-sm dark:text-white/90">
            Inventario
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" startIcon={<BoxIcon />} onClick={controlStockModal.openModal}>
              Control de Stock
            </Button>
            <Button size="sm" variant="primary" startIcon={<PlusIcon />} onClick={entradaModal.openModal}>
              Entrada
            </Button>
            <Button size="sm" variant="outline" startIcon={<TrashBinIcon />} onClick={mermasModal.openModal}>
              Mermas
            </Button>
            <Button size="sm" variant="outline" startIcon={<ListIcon />} onClick={kardexModal.openModal}>
              Kardex
            </Button>
          </div>
        </div>

        {/* Alertas de stock */}
        <StockAlertsCard
          onReponer={(itemId) => {
            setPresetItemId(itemId);
            entradaModal.openModal();
          }}
          onVerTodos={controlStockModal.openModal}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Gráfico */}
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
            <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white">
              Compras, Consumo y Mermas
            </h2>
            <LineChartOne />
          </div>

          {/* Panel de Catálogo */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
            <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-white">
              Gestión de Catálogo
            </h2>
            <div className="flex flex-col gap-3">
              <Button size="sm" variant="outline" className="w-full" startIcon={<BoxIcon />} onClick={controlStockModal.openModal}>
                Control de Stock
              </Button>
              <Button size="sm" variant="outline" className="w-full" startIcon={<ListIcon />} onClick={listaItemsModal.openModal}>
                Lista de items
              </Button>
              <Button size="sm" variant="outline" className="w-full" startIcon={<PlusIcon />} onClick={nuevoItemModal.openModal}>
                Registrar nuevo item
              </Button>
              <Button size="sm" variant="outline" className="w-full" startIcon={<GroupIcon />} onClick={alertasModal.openModal}>
                Registrar nuevo proveedor
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ======= Modales ======= */}

      {/* Control de Stock */}
      <ControlStockModal
        isOpen={controlStockModal.isOpen}
        onClose={controlStockModal.closeModal}
        onReponer={(itemId) => {
          setPresetItemId(itemId);
          controlStockModal.closeModal();
          entradaModal.openModal();
        }}
        onSaved={handleDataChanged}
      />

      {/* Registrar Nuevo Item */}
      <NuevoItemModal
        isOpen={nuevoItemModal.isOpen}
        onClose={nuevoItemModal.closeModal}
        categoriasOptions={categoriasOptions}
        unidadesOptions={unidadesOptions}
        onCreated={handleDataChanged}
      />

      <EntradaModal
        isOpen={entradaModal.isOpen}
        onClose={() => {
          entradaModal.closeModal();
          setPresetItemId(undefined);
        }}
        onSaved={handleDataChanged}
        presetItemId={presetItemId}
      />

      <MermasModal
        isOpen={mermasModal.isOpen}
        onClose={mermasModal.closeModal}
        onSaved={handleDataChanged}
      />

      <KardexModal
        isOpen={kardexModal.isOpen}
        onClose={kardexModal.closeModal}
      />

      <ListaItemsModal
        isOpen={listaItemsModal.isOpen}
        onClose={listaItemsModal.closeModal}
        categoriasOptions={categoriasOptions}
      />

      <AlertasModal
        isOpen={alertasModal.isOpen}
        onClose={alertasModal.closeModal}
        onSaved={handleDataChanged}
      />
    </>
  );
}

// app/inventario/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import LineChartOne from "@/components/charts/line/LineChartOne";
import StockAlertsCard from "@/components/inventario/StockAlertsCard";
import Button from "@/components/ui/button/Button";
import { PlusIcon, TrashBinIcon, ListIcon, GroupIcon } from "@/icons";
import { useModal } from "@/hooks/useModal";

// Modales desacoplados (ajusta la ruta si los guardaste en otro lugar)
import NuevoItemModal from "@/components/inventario/modals/NuevoItemModal";
import EntradaModal from "@/components/inventario/modals/EntradaModal";
import MermasModal from "@/components/inventario/modals/MermasModal";
import KardexModal from "@/components/inventario/modals/KardexModal";
import ListaItemsModal from "@/components/inventario/modals/ListaItemsModal";
import AlertasModal from "@/components/inventario/modals/AlertasModal";

export default function Inventario() {
  const router = useRouter();

  // Disclosures para cada modal
  const entradaModal = useModal();
  const mermasModal = useModal();
  const kardexModal = useModal();
  const nuevoItemModal = useModal();
  const listaItemsModal = useModal();
  const alertasModal = useModal();

  // Item preseleccionado en EntradaModal cuando se llega vía "Reponer" desde StockAlertsCard
  const [presetItemId, setPresetItemId] = useState<string | undefined>(undefined);

  // Opciones (las mismas que tenías)
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
      <div className="space-y-8">
        {/* Header */}
        <h1 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          Inventario
        </h1>

        {/* Alertas de stock (ancho completo) */}
        <StockAlertsCard
          onReponer={(itemId) => {
            setPresetItemId(itemId);
            entradaModal.openModal();
          }}
          onVerTodos={listaItemsModal.openModal}
        />

        <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Compras, Consumo y Mermas
          </h2>
          <LineChartOne />
        </div>

        {/* Operación diaria */}
        <div>
          <h4 className="mb-4 font-bold text-gray-800 text-title-sm dark:text-white/90">
            Operación diaria
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button size="md" variant="primary" startIcon={<PlusIcon />} onClick={entradaModal.openModal}>
              Registrar entrada
            </Button>
            <Button size="md" variant="outline" startIcon={<TrashBinIcon />} onClick={mermasModal.openModal}>
              Registrar mermas
            </Button>
            <Button size="md" variant="outline" startIcon={<ListIcon />} onClick={kardexModal.openModal}>
              Consultar Kardex
            </Button>
            <Button size="md" variant="outline" startIcon={<ListIcon />} onClick={listaItemsModal.openModal}>
              Lista de items
            </Button>
          </div>
        </div>

        {/* Catálogo y proveedores */}
        <div>
          <h4 className="mb-4 font-bold text-gray-800 text-title-sm dark:text-white/90">
            Catálogo y proveedores
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button size="sm" variant="outline" startIcon={<PlusIcon />} onClick={nuevoItemModal.openModal}>
              Registrar nuevo item
            </Button>
            <Button size="sm" variant="outline" startIcon={<GroupIcon />} onClick={alertasModal.openModal}>
              Registrar nuevo proveedor
            </Button>
          </div>
        </div>
      </div>

      {/* ======= Modales (componentes separados) ======= */}

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

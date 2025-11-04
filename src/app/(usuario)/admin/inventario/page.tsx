// app/inventario/page.tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import BarChartOne from "@/components/charts/bar/BarChartOne";
import LineChartOne from "@/components/charts/line/LineChartOne";
import Button from "@/components/ui/button/Button";
import { PlusIcon, TrashBinIcon, ListIcon, AlertIcon, CalenderIcon } from "@/icons";
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

  const itemsOptions = useMemo(
    () => [
      { value: "item1", label: "Item A" },
      { value: "item2", label: "Item B" },
      { value: "item3", label: "Item C" },
    ],
    []
  );

  const alertasOptions = useMemo(
    () => [
      { value: "bajo", label: "Stock Bajo" },
      { value: "critico", label: "Stock Crítico" },
      { value: "sobrestock", label: "Sobrestock" },
    ],
    []
  );

  // Cuando un modal guarda algo -> refrescamos widgets/listas
  const handleDataChanged = () => router.refresh();

  return (
    <>
      <div className="space-y-10 sm:space-y-6">
        {/* Header que ya tenías */}
        <h1 className="text-center mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          INVENTARIO
        </h1>

        <h2 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          Gestión de Items
        </h2>

        {/* Tus cards con gráficos */}
        <div className="grid grid-cols-2 space-x-6">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Disponibilidad de Items críticos
            </h3>
            <BarChartOne />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              Evolución de inventario mensual
            </h2>
            <LineChartOne />
          </div>
        </div>

        {/* Botoneras/Operaciones tal como estaban */}
        <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">Operaciones</h4>

        <div className="grid grid-cols-3 space-x-10">
          <Button size="md" variant="outline" startIcon={<PlusIcon />} onClick={entradaModal.openModal}>
            Registrar entrada de items
          </Button>
          <Button size="md" variant="outline" startIcon={<TrashBinIcon />} onClick={mermasModal.openModal}>
            Registrar mermas
          </Button>
          <Button size="md" variant="outline" startIcon={<ListIcon />} onClick={kardexModal.openModal}>
            Consultar Kardex
          </Button>
        </div>

        <div className="grid grid-cols-3 space-x-10">
          <Button size="md" variant="outline" startIcon={<PlusIcon />} onClick={nuevoItemModal.openModal}>
            Registrar nuevo item
          </Button>
          <Button size="md" variant="outline" startIcon={<ListIcon />} onClick={listaItemsModal.openModal}>
            Lista de items
          </Button>
          <Button size="md" variant="outline" startIcon={<AlertIcon />} onClick={alertasModal.openModal}>
            Configurar alertas de stock
          </Button>
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
        onClose={entradaModal.closeModal}
        itemsOptions={itemsOptions}
        onSaved={handleDataChanged}
      />

      <MermasModal
        isOpen={mermasModal.isOpen}
        onClose={mermasModal.closeModal}
        itemsOptions={itemsOptions}
        onSaved={handleDataChanged}
      />

      <KardexModal
        isOpen={kardexModal.isOpen}
        onClose={kardexModal.closeModal}
        itemsOptions={itemsOptions}
      />

      <ListaItemsModal
        isOpen={listaItemsModal.isOpen}
        onClose={listaItemsModal.closeModal}
        categoriasOptions={categoriasOptions}
      />

      <AlertasModal
        isOpen={alertasModal.isOpen}
        onClose={alertasModal.closeModal}
        alertasOptions={alertasOptions}
        onSaved={handleDataChanged}
      />
    </>
  );
}

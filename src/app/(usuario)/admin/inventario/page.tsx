"use client";

import BarChartOne from "@/components/charts/bar/BarChartOne";
import LineChartOne from "@/components/charts/line/LineChartOne";
import Button from "@/components/ui/button/Button";
import { PlusIcon, TrashBinIcon, ListIcon, AlertIcon, CalenderIcon } from "@/icons";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  nombre: string;
  sku: string;
  tipo: string;         // Debe coincidir con enum Prisma TipoItem
  unidad_code: string;  // p.ej. "unidad", "caja", "litro", etc.
};

export default function Inventario() {
  const router = useRouter();

  // Modales
  const entradaModal = useModal();
  const mermasModal = useModal();
  const kardexModal = useModal();
  const nuevoItemModal = useModal();
  const listaItemsModal = useModal();
  const alertasModal = useModal();

  // ---- Estado del formulario "Nuevo Item"
  const [form, setForm] = useState<FormState>({
    nombre: "",
    sku: "",
    tipo: "",         // asignamos desde Select
    unidad_code: "",  // asignamos desde Select
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Opciones UI
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

  // Mapeo UI -> Enum de Prisma (ajústalo si tus enums son distintos)
  // Ejemplos típicos: "VENDIBLE" | "INSUMO" | "PREPARACION" | "OFICINA"
  const mapCategoriaToEnum = useCallback((uiValue: string) => {
    const map: Record<string, string> = {
      vendible: "vendible",
      insumo: "insumo",
      prep: "preparacion",
      oficina: "oficina",
    };
    return map[uiValue] ?? uiValue.toUpperCase();
  }, []);

  // Handlers de inputs
  const handleTextChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleCategoriaChange = (value: string) => {
    setForm((prev) => ({ ...prev, tipo: mapCategoriaToEnum(value) }));
  };

  const handleUnidadChange = (value: string) => {
    setForm((prev) => ({ ...prev, unidad_code: value }));
  };

  // Enviar formulario a /api/items
  const submitNuevoItem = async () => {
    try {
      // Validación mínima en cliente
      if (!form.nombre || !form.tipo || !form.unidad_code) {
        window.alert("Por favor completa: Nombre, Categoría y Unidad de Medida.");
        return;
      }

      setIsSubmitting(true);
      const res = await fetch("/api/inventarios/agregarItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          sku: form.sku.trim() || null,
          tipo: form.tipo,                 // Enum válido para Prisma
          unidad_code: form.unidad_code,   // string (varchar(16))
          // activo: true // opcional; el backend ya lo deja por defecto en true
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo crear el item");
      }

      // Éxito
      // Limpia el formulario y cierra modal
      setForm({ nombre: "", sku: "", tipo: "", unidad_code: "" });
      nuevoItemModal.closeModal();

      // Refrescar la página para que se vea el nuevo item en listas/widgets
      router.refresh();

      // Feedback simple
      console.log("Item creado con éxito");
      // opcional: usa tu sistema de toasts si tienes (ej. react-hot-toast)
      // toast.success("Item creado con éxito");
    } catch (err: any) {
      console.error("Error al crear item:", err);
      window.alert(err?.message || "Error al crear item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = (modalType: string) => {
    switch (modalType) {
      case "entrada":
        entradaModal.closeModal();
        break;
      case "mermas":
        mermasModal.closeModal();
        break;
      case "kardex":
        kardexModal.closeModal();
        break;
      case "nuevoItem":
        // Aquí ya no cerramos directo; lo hace submitNuevoItem al éxito
        submitNuevoItem();
        break;
      case "listaItems":
        listaItemsModal.closeModal();
        break;
      case "alertas":
        alertasModal.closeModal();
        break;
    }
  };

  const handleSelectChange = (value: string) => {
    console.log("Selected value:", value);
  };

  const options = [
    { value: "item1", label: "Item A" },
    { value: "item2", label: "Item B" },
    { value: "item3", label: "Item C" },
  ];

  const alertasOptions = [
    { value: "bajo", label: "Stock Bajo" },
    { value: "critico", label: "Stock Crítico" },
    { value: "sobrestock", label: "Sobrestock" },
  ];

  return (
    <>
      <div className="space-y-10 sm:space-y-6">
        <h1 className="text-center mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          INVENTARIO
        </h1>

        <h2 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          Gestión de Items
        </h2>

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

      {/* Modal para Registrar Nuevo Item */}
      <Modal isOpen={nuevoItemModal.isOpen} onClose={nuevoItemModal.closeModal} className="max-w-[800px] m-4">
        <div className="no-scrollbar relative w-full max-w-[800px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Registrar Nuevo Item
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Complete la información para agregar un nuevo item al inventario.
            </p>
          </div>

          {/* IMPORTANTE: El envío real lo hace el botón "Registrar Item" con submitNuevoItem */}
          <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
            <div className="custom-scrollbar h-[550px] overflow-y-auto px-2 pb-3">
              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Información del Item
                </h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2">
                    <Label className="text-black">Nombre del Item</Label>
                    <Input
                      className="text-gray-dark"
                      type="text"
                      placeholder="Ingrese nombre completo"
                      value={form.nombre}
                      onChange={handleTextChange("nombre")}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Código (SKU)</Label>
                    <Input
                      className="text-gray-dark"
                      type="text"
                      placeholder="Código único"
                      value={form.sku}
                      onChange={handleTextChange("sku")}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Categoría</Label>
                    <Select
                      options={categoriasOptions}
                      placeholder="Seleccionar categoría"
                      // asumiendo que tu <Select> llama onChange con (value: string)
                      onChange={handleCategoriaChange}
                      className="dark:bg-dark-900"
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Unidad de Medida</Label>
                    <Select
                      options={unidadesOptions}
                      placeholder="Seleccionar unidad"
                      onChange={handleUnidadChange}
                      className="dark:bg-dark-900"
                    />
                  </div>

                  {/* Los siguientes campos se ignoran para el POST */}
                  <div className="col-span-2 lg:col-span-1 opacity-50 pointer-events-none">
                    <Label className="text-black">Stock Inicial</Label>
                    <Input className="text-gray-dark" type="number" placeholder="0" disabled />
                  </div>
                  <div className="col-span-2 lg:col-span-1 opacity-50 pointer-events-none">
                    <Label className="text-black">Stock Mínimo</Label>
                    <Input className="text-gray-dark" type="number" placeholder="Stock mínimo alerta" disabled />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={nuevoItemModal.closeModal} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleSave("nuevoItem")} disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Registrar Item"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal para Entrada de Items */}
      <Modal isOpen={entradaModal.isOpen} onClose={entradaModal.closeModal} className="max-w-[700px] m-4">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Registrar entrada de items
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Formulario para registrar nueva entrada de items al inventario.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Información de Entrada
                </h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Item</Label>
                    <Select
                      options={options}
                      placeholder="Seleccionar Item"
                      onChange={handleSelectChange}
                      className="dark:bg-dark-900"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Lote</Label>
                    <Input className="text-gray-dark" type="text" placeholder="Número de lote" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Cantidad</Label>
                    <Input className="text-gray-dark" type="number" placeholder="Ingrese cantidad" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Fecha de Vencimiento</Label>
                    <div className="relative">
                      <Input
                        type="date"
                        id="datePicker"
                        name="datePicker"
                        onChange={(e) => console.log(e.target.value)}
                      />
                      <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
                        <CalenderIcon />
                      </span>
                    </div>

                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Proveedor</Label>
                    <Input className="text-gray-dark" type="text" placeholder="Nombre del proveedor" />
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Notas</Label>
                    {/* <Textarea className="text-gray-dark" placeholder="Observaciones adicionales..." rows={3} /> */}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={entradaModal.closeModal}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleSave('entrada')}>
                Registrar Entrada
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal para Registrar Mermas */}
      <Modal isOpen={mermasModal.isOpen} onClose={mermasModal.closeModal} className="max-w-[700px] m-4">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Registrar mermas
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Formulario para registrar pérdidas o mermas de items.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Información de Mermas
                </h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Item</Label>
                    <Select
                      options={options}
                      placeholder="Seleccionar Item"
                      onChange={handleSelectChange}
                      className="dark:bg-dark-900"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Lote Afectado</Label>
                    <Input className="text-gray-dark" type="text" placeholder="Número de lote" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Cantidad Perdida</Label>
                    <Input className="text-gray-dark" type="number" placeholder="Cantidad" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Fecha de Pérdida</Label>
                    <Input className="text-gray-dark" type="date" />
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Tipo de Merma</Label>
                    <Select
                      options={[
                        { value: "vencimiento", label: "Vencimiento" },
                        { value: "dano", label: "Daño" },
                        { value: "robo", label: "Robo" },
                        { value: "error", label: "Error de registro" },
                      ]}
                      placeholder="Seleccionar tipo"
                      onChange={handleSelectChange}
                      className="dark:bg-dark-900"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Motivo Detallado</Label>
                    
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={mermasModal.closeModal}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleSave('mermas')}>
                Registrar Merma
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal para Consultar Kardex */}
      <Modal isOpen={kardexModal.isOpen} onClose={kardexModal.closeModal} className="max-w-[1000px] m-4">
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
                options={options}
                placeholder="Todos los items"
                onChange={handleSelectChange}
                className="dark:bg-dark-900"
              />
            </div>
            <div>
              <Label className="text-black">Fecha Desde</Label>
              <Input className="text-gray-dark" type="date" />
            </div>
            <div>
              <Label className="text-black">Fecha Hasta</Label>
              <Input className="text-gray-dark" type="date" />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg dark:border-gray-700">
            <div className="p-4 bg-gray-50 dark:bg-gray-800">
              <h5 className="font-semibold text-gray-800 dark:text-white">
                Movimientos de Inventario
              </h5>
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
            <Button size="sm" variant="outline" onClick={kardexModal.closeModal}>
              Cerrar
            </Button>
            <Button size="sm" onClick={() => handleSave('kardex')}>
              Exportar Reporte
            </Button>
          </div>
        </div>
      </Modal>

      
      {/* Modal para Registrar Nuevo Item */}
      <Modal isOpen={nuevoItemModal.isOpen} onClose={nuevoItemModal.closeModal} className="max-w-[800px] m-4">
        <div className="no-scrollbar relative w-full max-w-[800px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Registrar Nuevo Item
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Complete la información para agregar un nuevo item al inventario.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[550px] overflow-y-auto px-2 pb-3">
              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Información del Item
                </h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Nombre del Item</Label>
                    <Input className="text-gray-dark" type="text" placeholder="Ingrese nombre completo" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Código</Label>
                    <Input className="text-gray-dark" type="text" placeholder="Código único" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Categoría</Label>
                    <Select
                      options={categoriasOptions}
                      placeholder="Seleccionar categoría"
                      onChange={handleSelectChange}
                      className="dark:bg-dark-900"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Unidad de Medida</Label>
                    <Select
                      options={unidadesOptions}
                      placeholder="Seleccionar unidad"
                      onChange={handleSelectChange}
                      className="dark:bg-dark-900"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Stock Inicial</Label>
                    <Input className="text-gray-dark" type="number" placeholder="0" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Stock Mínimo</Label>
                    <Input className="text-gray-dark" type="number" placeholder="Stock mínimo alerta" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={nuevoItemModal.closeModal}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleSave('nuevoItem')}>
                Registrar Item
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal para Lista de Items */}
      <Modal isOpen={listaItemsModal.isOpen} onClose={listaItemsModal.closeModal} className="max-w-[1200px] m-4">
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
              <Input className="text-gray-dark w-full lg:w-64" type="text" placeholder="Buscar item..." />
              <Select
                options={categoriasOptions}
                placeholder="Todas las categorías"
                onChange={handleSelectChange}
                className="dark:bg-dark-900 w-full lg:w-48"
              />
            </div>
            <Button size="sm">
              Exportar Lista
            </Button>
          </div>

          <div className="border border-gray-200 rounded-lg dark:border-gray-700">
            <div className="p-4 bg-gray-50 dark:bg-gray-800">
              <h5 className="font-semibold text-gray-800 dark:text-white">
                Inventario Actual
              </h5>
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
                        <Button  variant="outline">
                          Editar
                        </Button>
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
                        <Button  variant="outline">
                          Editar
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 mt-6">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando 2 de 45 items
            </div>
            <div className="flex gap-3">
              <Button size="sm" variant="outline" onClick={listaItemsModal.closeModal}>
                Cerrar
              </Button>
              <Button size="sm" onClick={() => handleSave('listaItems')}>
                Actualizar Lista
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal para Configurar Alertas de Stock */}
      <Modal isOpen={alertasModal.isOpen} onClose={alertasModal.closeModal} className="max-w-[900px] m-4">
        <div className="no-scrollbar relative w-full max-w-[900px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Configurar Alertas de Stock
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Configure los umbrales y notificaciones para alertas de inventario.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[500px] overflow-y-auto px-2 pb-3">
              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Configuración General de Alertas
                </h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Tipo de Alerta</Label>
                    <Select
                      options={alertasOptions}
                      placeholder="Seleccionar tipo"
                      onChange={handleSelectChange}
                      className="dark:bg-dark-900"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Umbral de Stock (%)</Label>
                    <Input className="text-gray-dark" type="number" placeholder="20" />
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Items Aplicables</Label>
                    <Select
                      options={[
                        { value: "todos", label: "Todos los items" },
                        { value: "categoria", label: "Por categoría" },
                        { value: "especificos", label: "Items específicos" },
                      ]}
                      placeholder="Seleccionar alcance"
                      onChange={handleSelectChange}
                      className="dark:bg-dark-900"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Métodos de Notificación</Label>
                    <div className="space-y-3 mt-2">
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Notificación en sistema</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Correo electrónico</span>
                      </label>
                      <label className="flex items-center">
                        <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Mensaje de texto</span>
                      </label>
                    </div>
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Frecuencia de Revisión</Label>
                    <Select
                      options={[
                        { value: "diario", label: "Diario" },
                        { value: "semanal", label: "Semanal" },
                        { value: "mensual", label: "Mensual" },
                      ]}
                      placeholder="Seleccionar frecuencia"
                      onChange={handleSelectChange}
                      className="dark:bg-dark-900"
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Destinatarios de Alertas</Label>
                    {/* <Textarea 
                      className="text-gray-dark" 
                      placeholder="Ingrese emails separados por coma..." 
                      rows={2} 
                    /> */}
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Alertas Activas
                </h5>
                <div className="space-y-4">
                  <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <h6 className="font-medium text-yellow-800 dark:text-yellow-200">Stock Bajo - Item B</h6>
                        <p className="text-sm text-yellow-600 dark:text-yellow-300">Stock actual: 15 | Mínimo: 25</p>
                      </div>
                      <Button variant="outline">
                        Resolver
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={alertasModal.closeModal}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleSave('alertas')}>
                Guardar Configuración
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

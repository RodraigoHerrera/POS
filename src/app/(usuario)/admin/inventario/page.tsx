"use client";

import BarChartOne from "@/components/charts/bar/BarChartOne";
import LineChartOne from "@/components/charts/line/LineChartOne";
import Button from "@/components/ui/button/Button";
import { PlusIcon, TrashBinIcon, ListIcon, AlertIcon } from "@/icons";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";


export default function Inventario() {
  // Hooks para cada modal
  const entradaModal = useModal();
  const mermasModal = useModal();
  const kardexModal = useModal();
  const nuevoInsumoModal = useModal();
  const listaInsumosModal = useModal();
  const alertasModal = useModal();

  const handleSave = (modalType: string) => {
    console.log(`Guardando cambios para: ${modalType}`);
    // Cerrar el modal correspondiente
    switch(modalType) {
      case 'entrada':
        entradaModal.closeModal();
        break;
      case 'mermas':
        mermasModal.closeModal();
        break;
      case 'kardex':
        kardexModal.closeModal();
        break;
      case 'nuevoInsumo':
        nuevoInsumoModal.closeModal();
        break;
      case 'listaInsumos':
        listaInsumosModal.closeModal();
        break;
      case 'alertas':
        alertasModal.closeModal();
        break;
    }
  };

  const handleSelectChange = (value: string) => {
    console.log("Selected value:", value);
  };

  const options = [
    { value: "insumo1", label: "Insumo A" },
    { value: "insumo2", label: "Insumo B" },
    { value: "insumo3", label: "Insumo C" },
  ];

  const categoriasOptions = [
    { value: "medicamento", label: "Medicamento" },
    { value: "material_medico", label: "Material Médico" },
    { value: "limpieza", label: "Limpieza" },
    { value: "oficina", label: "Oficina" },
  ];

  const unidadesOptions = [
    { value: "unidad", label: "Unidad" },
    { value: "caja", label: "Caja" },
    { value: "paquete", label: "Paquete" },
    { value: "litro", label: "Litro" },
    { value: "kilogramo", label: "Kilogramo" },
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
          Gestión de Insumos
        </h2>
        <div className="grid grid-cols-2 space-x-6">
          <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              Disponibilidad de Insumos criticos
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

        <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          Operaciones
        </h4>

        <div className="grid grid-cols-3 space-x-10">
          <Button size="md" variant="outline" startIcon={<PlusIcon />} onClick={entradaModal.openModal}>
            Registrar entrada de insumos
          </Button>
          <Button size="md" variant="outline" startIcon={<TrashBinIcon />} onClick={mermasModal.openModal}>
            Registrar mermas
          </Button>
          <Button size="md" variant="outline" startIcon={<ListIcon />} onClick={kardexModal.openModal}>
            Consultar Kardex
          </Button>
        </div>

        <div className="grid grid-cols-3 space-x-10">
          <Button size="md" variant="outline" startIcon={<PlusIcon />} onClick={nuevoInsumoModal.openModal}>
            Registrar nuevo de insumo
          </Button>
          <Button size="md" variant="outline" startIcon={<ListIcon />} onClick={listaInsumosModal.openModal}>
            Lista de insumos
          </Button>
          <Button size="md" variant="outline" startIcon={<AlertIcon />} onClick={alertasModal.openModal}>
            Configurar alertas de stock
          </Button>
        </div>
      </div>

      {/* Modal para Entrada de Insumos */}
      <Modal isOpen={entradaModal.isOpen} onClose={entradaModal.closeModal} className="max-w-[700px] m-4">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Registrar entrada de insumos
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Formulario para registrar nueva entrada de insumos al inventario.
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
                    <Label className="text-black">Insumo</Label>
                    <Select
                      options={options}
                      placeholder="Seleccionar Insumo"
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
                    <Input className="text-gray-dark" type="date" />
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
              Formulario para registrar pérdidas o mermas de insumos.
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
                    <Label className="text-black">Insumo</Label>
                    <Select
                      options={options}
                      placeholder="Seleccionar Insumo"
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
              <Label className="text-black">Seleccionar Insumo</Label>
              <Select
                options={options}
                placeholder="Todos los insumos"
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
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Insumo</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Tipo</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Cantidad</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 text-sm">15/01/2024</td>
                      <td className="px-4 py-3 text-sm">Insumo A</td>
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
                      <td className="px-4 py-3 text-sm">Insumo A</td>
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

      {/* Modal para Registrar Nuevo Insumo */}
      <Modal isOpen={nuevoInsumoModal.isOpen} onClose={nuevoInsumoModal.closeModal} className="max-w-[800px] m-4">
        <div className="no-scrollbar relative w-full max-w-[800px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Registrar Nuevo Insumo
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Complete la información para agregar un nuevo insumo al inventario.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[550px] overflow-y-auto px-2 pb-3">
              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Información del Insumo
                </h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Nombre del Insumo</Label>
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
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Stock Máximo</Label>
                    <Input className="text-gray-dark" type="number" placeholder="Stock máximo permitido" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black">Precio Unitario</Label>
                    <Input className="text-gray-dark" type="number" placeholder="0.00" />
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Descripción</Label>
                    {/* <Textarea className="text-gray-dark" placeholder="Descripción detallada del insumo..." rows={3} /> */}
                  </div>
                  <div className="col-span-2 lg:col-span-2">
                    <Label className="text-black">Proveedor Principal</Label>
                    <Input className="text-gray-dark" type="text" placeholder="Nombre del proveedor" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={nuevoInsumoModal.closeModal}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleSave('nuevoInsumo')}>
                Registrar Insumo
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal para Lista de Insumos */}
      <Modal isOpen={listaInsumosModal.isOpen} onClose={listaInsumosModal.closeModal} className="max-w-[1200px] m-4">
        <div className="no-scrollbar relative w-full max-w-[1200px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Lista de Insumos
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Vista completa de todos los insumos en inventario.
            </p>
          </div>

          <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <Input className="text-gray-dark w-full lg:w-64" type="text" placeholder="Buscar insumo..." />
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
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Insumo</th>
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
                      <td className="px-4 py-3 text-sm">Insumo A</td>
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
                      <td className="px-4 py-3 text-sm">Insumo B</td>
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
              Mostrando 2 de 45 insumos
            </div>
            <div className="flex gap-3">
              <Button size="sm" variant="outline" onClick={listaInsumosModal.closeModal}>
                Cerrar
              </Button>
              <Button size="sm" onClick={() => handleSave('listaInsumos')}>
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
                    <Label className="text-black">Insumos Aplicables</Label>
                    <Select
                      options={[
                        { value: "todos", label: "Todos los insumos" },
                        { value: "categoria", label: "Por categoría" },
                        { value: "especificos", label: "Insumos específicos" },
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
                        <h6 className="font-medium text-yellow-800 dark:text-yellow-200">Stock Bajo - Insumo B</h6>
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
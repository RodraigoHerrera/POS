"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";
import DatePicker from '@/components/form/date-picker';

type Option = { value: string; label: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  // Ya no necesitamos pasar itemsOptions por props, el modal se encarga
  onSaved?: () => void;
  // Preselecciona un item (viene de "Reponer" en StockAlertsCard)
  presetItemId?: string;
};

export default function EntradaModal({ isOpen, onClose, onSaved, presetItemId }: Props) {
  const [isSaving, setIsSaving] = useState(false);

  // Estados para las listas dinámicas
  const [itemsOptions, setItemsOptions] = useState<Option[]>([]);
  const [provOptions, setProvOptions] = useState<Option[]>([]);

  const [payload, setPayload] = useState({
    item: "",
    lote: "",
    cantidad: "",
    fechaVenc: "",
    proveedor: "",
    motivo: "", // Agregué esto que faltaba en el state inicial
    costo_unitario: "",
    referencia: "",
  });

  // Efecto para cargar datos cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          
          // NOTA: Aquí debes reemplazar estas URLs con tus endpoints reales
          // Usamos Promise.all para cargar ambas listas en paralelo
          const [itemsRes, provRes] = await Promise.all([
             fetch('/api/inventarios/items'),      // Ejemplo: Endpoint de items
             fetch('/api/inventarios/proveedores')    // Ejemplo: Endpoint de proveedores
          ]);

          // Si no tienes endpoints aún, puedes simular la data aquí o ignorar el fetch
          // Asumiendo que tu API devuelve un array de objetos { id, nombre, ... }
          const itemsData = await itemsRes.ok ? await itemsRes.json() : [];
          const provData = await provRes.ok ? await provRes.json() : [];

          // Mapeamos la respuesta de la BD al formato del Select { value, label }
          const mappedItems = itemsData.filter((i: any) => i.tipo !== "vendible").map((i: any) => ({ 
            value: i.id.toString(), // o i._id 
            label: i.nombre // o i.descripcion
          }));

          const mappedProv = provData.map((p: any) => ({ 
            value: p.id.toString(), 
            label: p.nombre // o p.nombre

          }));

          setItemsOptions(mappedItems);
          setProvOptions(mappedProv);

          // Preselecciona el item venido de "Reponer" (StockAlertsCard) una vez cargadas las opciones
          if (presetItemId) {
            setPayload((p) => ({ ...p, item: presetItemId }));
          }

        } catch (error) {
          console.error("Error cargando datos:", error);
          // Opcional: Mostrar toast de error
        } finally {
        }
      };

      fetchData();
    }
  }, [isOpen, presetItemId]);

  const handleText =
    (key: keyof typeof payload) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setPayload((p) => ({ ...p, [key]: e.target.value }));

  // Refactorizamos para manejar cualquier Select (Item, Proveedor, Motivo)
  const handleSelect = (key: keyof typeof payload) => (val: string) => {
    setPayload((p) => ({ ...p, [key]: val }));
  };

  const handleDateChange = (date: Date) => {
    // Asumiendo que quieres guardar la fecha en formato ISO o string
    if(date) {
        setPayload((p) => ({ ...p, fechaVenc: date.toISOString() }));
    }
  };

  const save = async () => {
    try {
      setIsSaving(true);
      // Validaciones básicas antes de enviar
      if (!payload.item || !payload.cantidad) {
        alert("Por favor completa los campos obligatorios");
        return;
      }

      // TODO: Reemplazar con tu llamada real a la API
      const res = await fetch('/api/inventarios/registrarEntrada', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      console.log("Guardando payload:", payload);
      
      onSaved?.();
      onClose();
      // Resetear form si es necesario
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const optionsMotiv = [
      { value: "Compra", label: "Compra" },
      { value: "Ajuste", label: "Ajuste positivo" },
      { value: "Transferencia", label: "Transferencia" },
      { value: "Bonificacion", label: "Bonificación" },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[700px] m-4">
      <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Registrar entrada de items
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Formulario para registrar nueva entrada de items al inventario.
          </p>
        </div>

        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
          <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
            <div>
              <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                Información de Entrada
              </h5>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                {/* ITEM SELECT */}
                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Item</Label>
                  <Select
                    // key fuerza remount para reflejar defaultValue cuando llega el preset
                    key={payload.item || "sin-preset"}
                    options={itemsOptions}
                    placeholder={"Seleccionar Item"}
                    defaultValue={payload.item}
                    onChange={handleSelect("item")}
                    className="dark:bg-dark-900"
                  />
                </div>

                {/* MOTIVO SELECT */}
                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Motivo</Label>
                  <Select
                    options={optionsMotiv}
                    placeholder="Seleccionar motivo"
                    onChange={handleSelect("motivo")}
                    className="dark:bg-dark-900"
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Lote</Label>
                  <Input className="text-gray-dark" type="text" placeholder="Número de lote" onChange={handleText("lote")} />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Fecha de Vencimiento</Label>
                  <div className="">
                    <DatePicker
                      id="date-picker"
                      placeholder="Selecciona una fecha"
                      onChange={(dates) => {
                         // Asumiendo que dates[0] es el objeto Date
                         if (dates && dates.length > 0) handleDateChange(dates[0]);
                      }}
                    />
                  </div>
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Cantidad</Label>
                  <Input 
                    className="text-gray-dark" 
                    type="number" 
                    placeholder="Ingrese cantidad" 
                    onChange={handleText("cantidad")} 
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Costo unitario</Label>
                  <Input 
                    className="text-gray-dark" 
                    type="number" 
                    placeholder="Ingrese el costo" 
                    onChange={handleText("costo_unitario")} 
                  />
                </div>
                
                {/* PROVEEDOR SELECT */}
                <div className="col-span-2 lg:col-span-2">
                  <Label className="text-black">Proveedor</Label>
                  <Select
                    options={provOptions}
                    placeholder={"Seleccionar proveedor"}
                    onChange={handleSelect("proveedor")}
                    className="dark:bg-dark-900"
                  />                
                </div>

                <div className="col-span-2 lg:col-span-2">
                  <Label className="text-black">Referencia</Label>
                  <Input 
                    className="text-gray-dark" 
                    type="text" 
                    placeholder="Factura #123, Recibo #456..." 
                    onChange={handleText("referencia")} 
                  />
                </div>
                
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button size="sm" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} >
              {isSaving ? "Guardando..." : "Registrar Entrada"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
// components/inventario/modals/AlertasModal.tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Select from "@/components/form/Select";
import Button from "@/components/ui/button/Button";

type Option = { value: string; label: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  alertasOptions: Option[];
  onSaved?: () => void;
};

export default function AlertasModal({ isOpen, onClose, alertasOptions, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState({
    tipo: "",
    umbral: "",
    alcance: "",
    notifSistema: false,
    notifCorreo: false,
    notifSms: false,
    frecuencia: "",
    destinatarios: "",
  });

  const handleSelect = (key: keyof typeof config) => (val: string) =>
    setConfig((p) => ({ ...p, [key]: val }));

  const handleInput =
    (key: keyof typeof config) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setConfig((p) => ({ ...p, [key]: e.target.value }));

  const handleCheck =
    (key: "notifSistema" | "notifCorreo" | "notifSms") => (e: React.ChangeEvent<HTMLInputElement>) =>
      setConfig((p) => ({ ...p, [key]: e.target.checked }));

  const save = async () => {
    try {
      setIsSaving(true);
      // TODO: POST /api/inventarios/alertas con config
      onSaved?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[900px] m-4">
      <div className="no-scrollbar relative w-full max-w-[900px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Configurar Alertas de Stock
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Configure los umbrales y notificaciones para alertas de inventario.
          </p>
        </div>

        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
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
                    onChange={handleSelect("tipo")}
                    className="dark:bg-dark-900"
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label className="text-black">Umbral de Stock (%)</Label>
                  <Input className="text-gray-dark" type="number" placeholder="20" onChange={handleInput("umbral")} />
                </div>

                <div className="col-span-2">
                  <Label className="text-black">Items Aplicables</Label>
                  <Select
                    options={[
                      { value: "todos", label: "Todos los items" },
                      { value: "categoria", label: "Por categoría" },
                      { value: "especificos", label: "Items específicos" },
                    ]}
                    placeholder="Seleccionar alcance"
                    onChange={handleSelect("alcance")}
                    className="dark:bg-dark-900"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-black">Métodos de Notificación</Label>
                  <div className="space-y-3 mt-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 focus:ring-blue-500" onChange={handleCheck("notifSistema")} />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Notificación en sistema</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 focus:ring-blue-500" onChange={handleCheck("notifCorreo")} />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Correo electrónico</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 focus:ring-blue-500" onChange={handleCheck("notifSms")} />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Mensaje de texto</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label className="text-black">Frecuencia de Revisión</Label>
                  <Select
                    options={[
                      { value: "diario", label: "Diario" },
                      { value: "semanal", label: "Semanal" },
                      { value: "mensual", label: "Mensual" },
                    ]}
                    placeholder="Seleccionar frecuencia"
                    onChange={handleSelect("frecuencia")}
                    className="dark:bg-dark-900"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-black">Destinatarios de Alertas</Label>
                  <Input
                    className="text-gray-dark"
                    type="text"
                    placeholder="emails separados por coma (opcional)"
                    onChange={handleInput("destinatarios")}
                  />
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
                      <Button variant="outline">Resolver</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button size="sm" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

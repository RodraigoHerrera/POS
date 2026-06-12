// components/proveedores/modals/ProveedorModal.tsx
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function ProveedorModal({ isOpen, onClose, onSaved }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nombre: "",
    nit: "",
    contacto: "",
    telefono: "",
    email: "",
  });

  const handleInput =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const save = async () => {
    try {
      setIsSaving(true);
      setError(null);

      const res = await fetch("/api/inventarios/registrarProveedor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("No se pudo registrar el proveedor");
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Error desconocido");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[600px] m-4">
      <div className="no-scrollbar relative w-full max-w-[600px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Registrar Proveedor
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            Complete los datos del nuevo proveedor.
          </p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-100 p-2 rounded-md">
            {error}
          </p>
        )}

        <form className="flex flex-col" onSubmit={(e) => e.preventDefault()}>
          <div className="custom-scrollbar max-h-[400px] overflow-y-auto px-2 pb-3">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">

              <div className="col-span-2">
                <Label className="text-black">Nombre del Proveedor</Label>
                <Input
                  className="text-gray-dark"
                  type="text"
                  placeholder="Ej: Distribuidora La Suprema"
                  onChange={handleInput("nombre")}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label className="text-black">NIT</Label>
                <Input
                  className="text-gray-dark"
                  type="text"
                  placeholder="123456789"
                  onChange={handleInput("nit")}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label className="text-black">Contacto</Label>
                <Input
                  className="text-gray-dark"
                  type="text"
                  placeholder="Nombre del responsable"
                  onChange={handleInput("contacto")}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label className="text-black">Teléfono</Label>
                <Input
                  className="text-gray-dark"
                  type="text"
                  placeholder="777-12345"
                  onChange={handleInput("telefono")}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label className="text-black">Email</Label>
                <Input
                  className="text-gray-dark"
                  type="email"
                  placeholder="correo@proveedor.com"
                  onChange={handleInput("email")}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button size="sm" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar Proveedor"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import Button from "@/components/ui/button/Button";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { EnvelopeIcon } from "@/icons";
import Switch from "@/components/form/switch/Switch";

interface Empleado {
  id: number;
  nombre: string;
  fotoUrl: string;
  rol: string;
  estado: string;
  correo: string;
  celular: string;
  creado: string;
}

type FormState = {
  nombre: string;
  usuario: string;
  correo: string;
  celular: string;
  contraseña: string;
  confirmarContraseña: string;
};

const INITIAL_FORM: FormState = {
  nombre: "",
  usuario: "",
  correo: "",
  celular: "",
  contraseña: "",
  confirmarContraseña: "",
};

export default function UsuariosSucursal() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { isOpen, openModal, closeModal } = useModal();

  // ---------- Helpers ----------
  const actualizarCampo = useCallback(
    (campo: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [campo]: e.target.value })),
    []
  );

  const obtenerRol = (flagAdmin: boolean) =>
    flagAdmin ? "Administrador" : "Cajero";

  const cargarEmpleados = useCallback(async () => {
    try {
      const res = await fetch("/api/usuarios", { credentials: "include" });
      const data = await res.json();
      setEmpleados(data);
    } catch (err) {
      console.error("Error al obtener empleados:", err);
    }
  }, []);

  // ---------- Effects ----------
  useEffect(() => {
    cargarEmpleados();
  }, [cargarEmpleados]);

  // ---------- Handlers ----------
  const handleToggleAdmin = (checked: boolean) => setIsAdmin(checked);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/registerAdmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursal_id: 2,
          nombre: form.nombre,
          correo: form.correo,
          celular: form.celular,
          contraseña: form.contraseña,
          usuario: form.usuario,
          rol: obtenerRol(isAdmin),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        console.log("Administrador registrado con éxito:", data);
        closeModal();
        // Opcional (sin cambiar funcionalidad): refrescar listado
        await cargarEmpleados();
        setForm(INITIAL_FORM);
        setIsAdmin(false);
      } else {
        setErrorMsg(data.message || "Ocurrió un error al registrar el administrador");
      }
    } catch (err) {
      setErrorMsg("No se pudo conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  // ---------- UI ----------
  return (
    <>
      <div className="space-y-10 rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:space-y-6">
        <h1 className="mt-2 text-center font-bold text-gray-800 text-title-sm dark:text-white/90">
          USUARIOS DE LA SUCURSAL
        </h1>

        <div>
          {empleados.map((empleado) => (
            <UserMetaCard key={empleado.id} userData={empleado} />
          ))}
        </div>

        <Button size="sm" variant="outline" className="w-full" onClick={openModal}>
          Agregar Usuario
        </Button>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[700px]">
        <div className="space-y-4">
          <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
            <div className="px-2 pr-14">
              <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                Editar Información Personal
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                Actualice sus datos para mantener su perfil actualizado.
              </p>
            </div>

            {errorMsg && (
              <div className="mx-2 mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                {errorMsg}
              </div>
            )}

            <form className="flex flex-col" onSubmit={handleSubmit}>
              <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
                <div className="mt-7">
                  <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                    Información Personal
                  </h5>

                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                    <div className="col-span-2 lg:col-span-1">
                      <Label className="text-black">Nombre Completo</Label>
                      <Input
                        className="text-gray-500 dark:border-gray-800 dark:text-gray-400"
                        type="text"
                        placeholder="Juan Pérez"
                        value={form.nombre}
                        onChange={actualizarCampo("nombre")}
                      />
                    </div>

                    <div className="col-span-2 lg:col-span-1">
                      <Label className="text-black">Nombre de Usuario</Label>
                      <Input
                        className="text-gray-500 dark:border-gray-800 dark:text-gray-400"
                        type="text"
                        placeholder="juanperez"
                        value={form.usuario}
                        onChange={actualizarCampo("usuario")}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label className="text-black">Correo Electrónico</Label>
                      <div className="relative">
                        <Input
                          placeholder="info@gmail.com"
                          type="text"
                          className="pl-[62px] text-gray-500 dark:border-gray-800 dark:text-gray-400"
                          value={form.correo}
                          onChange={actualizarCampo("correo")}
                        />
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 border-r border-gray-200 px-3.5 py-3 text-gray-500 dark:border-gray-800 dark:text-gray-400">
                          <EnvelopeIcon />
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Label className="text-black">Celular</Label>
                      <Input
                        className="text-gray-500 dark:border-gray-800 dark:text-gray-400"
                        type="text"
                        placeholder="6XXXXXX"
                        value={form.celular}
                        onChange={actualizarCampo("celular")}
                      />
                    </div>

                    <div className="col-span-2 lg:col-span-1">
                      <Label className="text-black">Contraseña</Label>
                      <Input
                        className="text-gray-500 dark:border-gray-800 dark:text-gray-400"
                        type="password"
                        placeholder="********"
                        value={form.contraseña}
                        onChange={actualizarCampo("contraseña")}
                      />
                    </div>

                    <div className="col-span-2 lg:col-span-1">
                      <Label className="text-black">Confirmar Contraseña</Label>
                      <Input
                        className="text-gray-500 dark:border-gray-800 dark:text-gray-400"
                        type="password"
                        placeholder="********"
                        value={form.confirmarContraseña}
                        onChange={actualizarCampo("confirmarContraseña")}
                      />
                    </div>

                    <div className="col-span-2">
                      <Switch
                        label="Privilegios de Administrador"
                        defaultChecked={false}
                        onChange={handleToggleAdmin}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={closeModal}
                  disabled={isLoading}
                >
                  Cerrar
                </Button>
                <Button size="sm" disabled={isLoading}>
                  {isLoading ? "Registrando..." : "Registrar Usuario"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </>
  );
}

"use client";

import React, { useCallback, useState } from "react";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import { useFetchData } from "@/hooks/useFetchData";
import Button from "@/components/ui/button/Button";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import { validarNuevaContrasena } from "@/lib/contrasenaEmpleado";
import { resumenUsuarios } from "@/lib/usuariosAdmin";

interface Empleado {
  id: number;
  nombre: string;
  usuario: string;
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

const PlusIcon = () => (
  <svg className="stroke-current" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Placeholder con las mismas dimensiones que la fila de UserMetaCard
function UsuarioSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:w-64 lg:w-72">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg sm:w-24" />
      </div>
    </div>
  );
}

function ResumenItem({ etiqueta, valor, loading }: { etiqueta: string; valor: number; loading: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{etiqueta}</p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-10" />
      ) : (
        <p className="text-title-sm font-bold text-gray-800 dark:text-white/90">{valor}</p>
      )}
    </div>
  );
}

export default function UsuariosSucursal() {
  const {
    data: empleados,
    loading: loadingEmpleados,
    error: errorEmpleados,
    reload: cargarEmpleados,
  } = useFetchData<Empleado[]>("/api/usuarios", []);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isAdmin, setIsAdmin] = useState(false);
  // Cambia al limpiar el formulario para reiniciar el Switch (no controlado)
  const [formKey, setFormKey] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { isOpen, openModal, closeModal } = useModal();
  const resumen = resumenUsuarios(empleados);

  // ---------- Helpers ----------
  const actualizarCampo = useCallback(
    (campo: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [campo]: e.target.value })),
    []
  );

  const obtenerRol = (flagAdmin: boolean) =>
    flagAdmin ? "Administrador" : "Cajero";

  const limpiarFormulario = () => {
    setForm(INITIAL_FORM);
    setIsAdmin(false);
    setErrorMsg("");
    setFormKey((k) => k + 1);
  };

  // ---------- Handlers ----------
  const handleToggleAdmin = (checked: boolean) => setIsAdmin(checked);

  const handleClose = () => {
    limpiarFormulario();
    closeModal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const errorContrasena = validarNuevaContrasena(form.contraseña, form.confirmarContraseña);
    if (errorContrasena) {
      setErrorMsg(errorContrasena);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/registerAdmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          correo: `${form.correo.trim()}@gmail.com`,
          celular: form.celular,
          contraseña: form.contraseña,
          usuario: form.usuario,
          rol: obtenerRol(isAdmin),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        closeModal();
        limpiarFormulario();
        await cargarEmpleados();
      } else {
        setErrorMsg(data.message || "Ocurrió un error al registrar el usuario");
      }
    } catch {
      setErrorMsg("No se pudo conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">
              Usuarios de la sucursal
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Gestione los datos, roles y accesos de su equipo.
            </p>
          </div>
          <Button size="sm" onClick={openModal} startIcon={<PlusIcon />} className="w-full sm:w-auto">
            Agregar usuario
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <ResumenItem etiqueta="Total" valor={resumen.total} loading={loadingEmpleados} />
          <ResumenItem etiqueta="Activos" valor={resumen.activos} loading={loadingEmpleados} />
          <ResumenItem etiqueta="Administradores" valor={resumen.administradores} loading={loadingEmpleados} />
        </div>

        <div className="space-y-3">
          {loadingEmpleados ? (
            Array.from({ length: 3 }).map((_, i) => <UsuarioSkeleton key={i} />)
          ) : errorEmpleados ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-3 rounded-2xl border border-error-200 bg-error-50 p-6 text-center text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
            >
              No se pudo cargar la lista de usuarios.
              <Button size="sm" variant="outline" onClick={cargarEmpleados}>
                Reintentar
              </Button>
            </div>
          ) : empleados.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
              <p className="font-medium text-gray-800 dark:text-white/90">Todavía no hay usuarios</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Agregue al primer integrante de su equipo para empezar.
              </p>
            </div>
          ) : (
            empleados.map((empleado) => (
              <UserMetaCard key={empleado.id} userData={empleado} onSaved={cargarEmpleados} />
            ))
          )}
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={handleClose} className="m-4 max-w-[700px]">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Agregar Usuario
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Registre a un nuevo integrante del equipo de la sucursal.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mx-2 mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            >
              {errorMsg}
            </div>
          )}

          <form className="flex flex-col" onSubmit={handleSubmit}>
            <div className="custom-scrollbar max-h-[450px] overflow-y-auto px-2 pb-3">
              <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                Información Personal
              </h5>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="nuevo-nombre">Nombre Completo</Label>
                  <Input
                    id="nuevo-nombre"
                    type="text"
                    placeholder="Juan Pérez"
                    value={form.nombre}
                    onChange={actualizarCampo("nombre")}
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="nuevo-usuario">Nombre de Usuario</Label>
                  <Input
                    id="nuevo-usuario"
                    type="text"
                    placeholder="juanperez"
                    value={form.usuario}
                    onChange={actualizarCampo("usuario")}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="nuevo-correo">Correo Electrónico</Label>
                  <div className="flex items-stretch gap-2">
                    <Input
                      id="nuevo-correo"
                      placeholder="ejemplo"
                      type="text"
                      value={form.correo}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, correo: e.target.value.split("@")[0] }))
                      }
                    />
                    <span className="flex h-11 shrink-0 items-center whitespace-nowrap rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-white/5 dark:text-gray-400">
                      @gmail.com
                    </span>
                  </div>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="nuevo-celular">Celular</Label>
                  <Input
                    id="nuevo-celular"
                    type="text"
                    placeholder="6XXXXXX"
                    value={form.celular}
                    onChange={actualizarCampo("celular")}
                  />
                </div>
              </div>

              <h5 className="mb-5 mt-7 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                Acceso
              </h5>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="nuevo-contrasena">Contraseña</Label>
                  <Input
                    id="nuevo-contrasena"
                    type="password"
                    placeholder="********"
                    value={form.contraseña}
                    onChange={actualizarCampo("contraseña")}
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="nuevo-confirmar">Confirmar Contraseña</Label>
                  <Input
                    id="nuevo-confirmar"
                    type="password"
                    placeholder="********"
                    value={form.confirmarContraseña}
                    onChange={actualizarCampo("confirmarContraseña")}
                  />
                </div>

                <p className="col-span-2 -mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                  Es el PIN con el que el usuario ingresa desde la pantalla de selección.
                </p>

                <div className="col-span-2">
                  <Switch
                    key={formKey}
                    label="Privilegios de Administrador"
                    defaultChecked={false}
                    onChange={handleToggleAdmin}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
              <Button type="button" size="sm" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cerrar
              </Button>
              <Button type="submit" size="sm" disabled={isLoading}>
                {isLoading ? "Registrando..." : "Registrar Usuario"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

"use client";

import React, { useState, useCallback } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Badge from "../ui/badge/Badge";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Image from "next/image";
import { validarNuevaContrasena } from "@/lib/contrasenaEmpleado";
import { esEmpleadoActivo, esFotoPorDefecto, inicialesEmpleado } from "@/lib/empleadosKiosco";
import { ROLES_EMPLEADO, estadoNormalizado } from "@/lib/usuariosAdmin";

interface User {
  id: number;
  nombre: string;
  usuario?: string;
  fotoUrl: string;
  rol: string;
  estado: string;
  correo: string;
  celular: string;
  creado: string;
}

type UpdatePayload = Partial<User> & { id: number; contrasena?: string };

// Mismo aspecto que el componente Select del sistema, pero nativo para que
// el valor viaje en el FormData del formulario
const SELECT_CLASSES =
  "h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";

const ChevronIcon = () => (
  <svg
    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 stroke-current text-gray-500 dark:text-gray-400"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path d="M4.79175 7.396L10.0001 12.6043L15.2084 7.396" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MailIcon = () => (
  <svg className="shrink-0 stroke-current" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 6h16v12H4z" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="m4 7 8 6 8-6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="shrink-0 stroke-current" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="7" y="3" width="10" height="18" rx="2" strokeWidth="1.5" />
    <path d="M11 17.5h2" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const EditIcon = () => (
  <svg className="fill-current" width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
    />
  </svg>
);

export default function UserMetaCard({ userData, onSaved }: { userData: User; onSaved?: () => void }) {
  const { isOpen, openModal, closeModal } = useModal();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const activo = esEmpleadoActivo(userData.estado);
  const esAdmin = userData.rol === "Administrador";
  // Si el rol guardado no está en la lista, se conserva como opción para no perderlo
  const roles: string[] = ROLES_EMPLEADO.includes(userData.rol as (typeof ROLES_EMPLEADO)[number])
    ? [...ROLES_EMPLEADO]
    : [...ROLES_EMPLEADO, userData.rol];

  // ---- API helpers ----
  const updateUser = useCallback(async (payload: UpdatePayload) => {
    const res = await fetch(`/api/usuarios/modificar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  }, []);

  // ---- Form helpers ----
  const getFormValues = (form: HTMLFormElement): UpdatePayload => {
    const fd = new FormData(form);
    return {
      id: userData.id,
      nombre: (fd.get("nombre") as string) ?? "",
      correo: (fd.get("correo") as string) ?? "",
      celular: (fd.get("celular") as string) ?? "",
      estado: (fd.get("estado") as string) ?? "",
      rol: (fd.get("rol") as string) ?? "",
    };
  };

  const handleClose = () => {
    setErrorMsg("");
    closeModal();
  };

  // ---- Handlers ----
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;

    setErrorMsg("");
    setIsSaving(true);

    try {
      const payload = getFormValues(e.currentTarget);

      // La contraseña solo se cambia si el administrador escribió una nueva
      const fd = new FormData(e.currentTarget);
      const nuevaContrasena = (fd.get("nuevaContrasena") as string) ?? "";
      const confirmarContrasena = (fd.get("confirmarContrasena") as string) ?? "";
      if (nuevaContrasena !== "" || confirmarContrasena !== "") {
        const errorContrasena = validarNuevaContrasena(nuevaContrasena, confirmarContrasena);
        if (errorContrasena) {
          setErrorMsg(errorContrasena);
          return;
        }
        payload.contrasena = nuevaContrasena;
      }

      const res = await updateUser(payload);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error("Error al guardar:", data);
        setErrorMsg(data?.message || "No se pudo guardar los cambios.");
        return;
      }

      closeModal();
      onSaved?.();
    } catch (err) {
      console.error("Fallo de red o servidor:", err);
      setErrorMsg("Ocurrió un problema de red o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- UI ----
  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-800 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-error-50 text-lg font-semibold text-brand-500 dark:border-gray-800 dark:bg-brand-500/15 dark:text-brand-400 ${
                activo ? "" : "opacity-50 grayscale"
              }`}
            >
              {esFotoPorDefecto(userData.fotoUrl) ? (
                inicialesEmpleado(userData.usuario || userData.nombre)
              ) : (
                <Image width={56} height={56} src={userData.fotoUrl} alt={userData.nombre} />
              )}
            </div>

            <div className="min-w-0">
              <h4 className="truncate text-base font-semibold text-gray-800 dark:text-white/90">
                {userData.nombre}
              </h4>
              {userData.usuario && (
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">@{userData.usuario}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge size="sm" color={esAdmin ? "primary" : "light"}>
                  {userData.rol}
                </Badge>
                <Badge size="sm" color={activo ? "success" : "error"}>
                  {activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400 sm:w-64 sm:border-t-0 sm:pt-0 lg:w-72">
            <span className="flex min-w-0 items-center gap-2">
              <MailIcon />
              <span className="truncate">{userData.correo || "Sin correo"}</span>
            </span>
            <span className="flex items-center gap-2">
              <PhoneIcon />
              <span>{userData.celular || "Sin celular"}</span>
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={openModal}
            startIcon={<EditIcon />}
            className="w-full sm:w-auto"
            aria-label={`Editar a ${userData.nombre}`}
          >
            Editar
          </Button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={handleClose} className="m-4 max-w-[700px]">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Editar Usuario
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Actualice los datos, el rol o la contraseña de {userData.nombre}.
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
                <div className="col-span-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" name="nombre" type="text" defaultValue={userData.nombre} />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="correo">Correo Electrónico</Label>
                  <Input id="correo" name="correo" type="text" defaultValue={userData.correo} />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="celular">Celular</Label>
                  <Input id="celular" name="celular" type="text" defaultValue={userData.celular} />
                </div>
              </div>

              <h5 className="mb-5 mt-7 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                Acceso
              </h5>

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="rol">Rol</Label>
                  <div className="relative">
                    <select id="rol" name="rol" className={SELECT_CLASSES} defaultValue={userData.rol}>
                      {roles.map((rol) => (
                        <option key={rol} value={rol} className="dark:bg-gray-900">
                          {rol}
                        </option>
                      ))}
                    </select>
                    <ChevronIcon />
                  </div>
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="estado">Estado</Label>
                  <div className="relative">
                    <select
                      id="estado"
                      name="estado"
                      className={SELECT_CLASSES}
                      defaultValue={estadoNormalizado(userData.estado)}
                    >
                      <option value="Activo" className="dark:bg-gray-900">Activo</option>
                      <option value="Inactivo" className="dark:bg-gray-900">Inactivo</option>
                    </select>
                    <ChevronIcon />
                  </div>
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="nuevaContrasena">Nueva Contraseña</Label>
                  <Input id="nuevaContrasena" name="nuevaContrasena" type="password" placeholder="********" />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label htmlFor="confirmarContrasena">Confirmar Contraseña</Label>
                  <Input id="confirmarContrasena" name="confirmarContrasena" type="password" placeholder="********" />
                </div>

                <p className="col-span-2 -mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                  Deje la contraseña en blanco para mantener la actual. Un usuario inactivo no puede ingresar con su PIN.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
              <Button type="button" size="sm" variant="outline" onClick={handleClose} disabled={isSaving}>
                Cerrar
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

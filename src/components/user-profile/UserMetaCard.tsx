"use client";

import React, { useState, useCallback } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Image from "next/image";

interface User {
  id: number;
  nombre: string;
  fotoUrl: string;
  rol: string;
  estado: string;
  correo: string;
  celular: string;
  creado: string;
}

interface UserMetaCardProps {
  userData: User;
}

type UpdatePayload = Partial<User> & { id: number };

export default function UserMetaCard({ userData, onSaved }: { userData: User; onSaved?: () => void }) {
  const { isOpen, openModal, closeModal } = useModal();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

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

  // ---- Handlers ----
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;

    setErrorMsg("");
    setIsSaving(true);

    try {
      const payload = getFormValues(e.currentTarget);
      const res = await updateUser(payload);

      if (!res.ok) {
        const text = await res.text();
        console.error("Error al guardar:", text);
        setErrorMsg("No se pudo guardar los cambios.");
        return;
      }

      closeModal();
      onSaved?.();
      // Aquí podrías revalidar datos (SWR/React Query) si lo usas.
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
      <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-col items-center gap-6 xl:flex-row">
            <div className="h-20 w-20 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
              <Image width={80} height={80} src={userData.fotoUrl} alt="user" />
            </div>

            <div className="order-3 xl:order-2">
              <h4 className="mb-2 text-center text-lg font-semibold text-gray-800 dark:text-white/90 xl:text-left">
                {userData.nombre} - {userData.estado}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">{userData.celular}</p>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{userData.rol}</p>
              </div>
            </div>
          </div>

          <button
            onClick={openModal}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
          >
            <svg
              className="fill-current"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
              />
            </svg>
            Editar
          </button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[700px]">
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
                  <div className="col-span-2">
                    <Label className="text-black" htmlFor="nombre">
                      Nombre
                    </Label>
                    <Input
                      id="nombre"
                      name="nombre"
                      type="text"
                      className="text-gray-dark"
                      defaultValue={userData.nombre}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-black" htmlFor="correo">
                      Correo Electrónico
                    </Label>
                    <Input
                      id="correo"
                      name="correo"
                      type="text"
                      className="text-gray-dark"
                      defaultValue={userData.correo}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label className="text-black" htmlFor="celular">
                      Celular
                    </Label>
                    <Input
                      id="celular"
                      name="celular"
                      type="text"
                      className="text-gray-dark"
                      defaultValue={userData.celular}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black" htmlFor="estado">
                      Estado
                    </Label>
                    <Input
                      id="estado"
                      name="estado"
                      type="text"
                      className="text-gray-dark"
                      defaultValue={userData.estado}
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label className="text-black" htmlFor="rol">
                      Rol
                    </Label>
                    <Input
                      id="rol"
                      name="rol"
                      type="text"
                      className="text-gray-dark"
                      defaultValue={userData.rol}
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
                disabled={isSaving}
              >
                Cerrar
              </Button>
              <Button  size="sm" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}

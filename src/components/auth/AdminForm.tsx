"use client";

import Input from "@/components/form/input/InputField"; // Componente de campo de entrada personalizado
import Label from "@/components/form/Label"; // Componente para etiquetas de formulario
import Button from "@/components/ui/button/Button"; // Componente de botón personalizado
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons"; // Importación de iconos usados en la UI
import Link from "next/link"; // Componente de navegación de Next.js para enlaces internos
import React, { useState } from "react"; // Importación de React y hook useState para manejo de estados
import { useRouter } from "next/navigation"; // Hook de Next.js para manejar la navegación programática
import { useSearchParams } from "next/navigation";

export default function AdminForm() {

  const [showPassword, setShowPassword] = useState(false);
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [correo, setCorreo] = useState("");
  const [celular, setCelular] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [confirmarContraseña, setConfirmarContraseña] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [erroresCampo, setErroresCampo] = useState<{ [key: string]: string }>({});
  const router = useRouter();

  // Capitaliza la primera letra y pasa el resto a minúsculas
  const capitalizar = (texto: string) =>
    texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : "";

  const searchParams = useSearchParams();
  const sucursalId = searchParams.get("sucursalId");


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const nuevosErrores: { [key: string]: string } = {};

    if (!nombre) nuevosErrores.nombre = "El nombre es obligatorio";

    if (!usuario) nuevosErrores.usuario = "El nombre de usuario es obligatorio";

    // if (!correo) {
    //   nuevosErrores.correo = "El correo es obligatorio";
    // } else if (!/^[\w.+\-]+@gmail\.com$/i.test(correo)) {
    //   nuevosErrores.correo = "El correo debe terminar en @gmail.com";
    // }

    if (!celular) {
      nuevosErrores.celular = "El celular es obligatorio";
    } else if (!/^\d{8,15}$/.test(celular)) {
      nuevosErrores.celular = "El celular debe contener solo números (8‑15 dígitos)";
    }

    if (!contraseña) {
      nuevosErrores.contraseña = "La contraseña es obligatoria";
    } else if (contraseña.length < 8) {
      nuevosErrores.contraseña = "La contraseña debe tener al menos 8 caracteres";
    }

    // if (confirmarContraseña !== contraseña) {
    //   nuevosErrores.confirmarContraseña = "Las contraseñas no coinciden";
    // }

    if (Object.keys(nuevosErrores).length > 0) {
      setErroresCampo(nuevosErrores);
      setIsLoading(false);
      return;
    }

    setErroresCampo({});

    const nombreFormateado = capitalizar(nombre);

    const res = await fetch("/api/auth/registerAdmin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sucursal_id: sucursalId,
        nombre: nombreFormateado,
        correo,
        celular,
        contraseña,
        usuario,
        rol: "Administrador",
      }),
      
    });

    const data = await res.json();

    if (res.ok) {
      router.push("/");
    } else {
      setError(data.message || "Ocurrió un error al registrar el administrador");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full overflow-y-auto no-scrollbar bg-[#0C0C0F]/95 p-6 rounded shadow max-w-lg">
      {/* Enlace para volver al dashboard */}
      {/* <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/admin"
          className="inline-flex items-center text-sm text-gray-300 transition-colors hover:text-gray-400"
        >
          <ChevronLeftIcon />
          Volver al dashboard
        </Link>
      </div> */}

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        {/* Encabezado */}
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 font-semibold text-gray-25 text-title-sm sm:text-title-md text-center">
            Registrar Administrador
          </h1>
          <p className="text-sm text-gray-200 text-center">
            ¡Bienvenido! Completa el formulario para crear tu cuenta de administrador.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            {/* Nombre */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <Label>
                  Nombre Completo<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Nombre completo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
                {erroresCampo.nombre && (
                  <p className="text-sm text-error-500">{erroresCampo.nombre}</p>
                )}
              </div>
              <div className="sm:col-span-1">
                <Label>
                  Nombre de Usuario<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                />
                {erroresCampo.usuario && (
                  <p className="text-sm text-error-500">{erroresCampo.usuario}</p>
                )}
              </div>
            </div>

            {/* Correo y Celular */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <Label>
                  Correo<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="Correo electrónico"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
                {erroresCampo.correo && (
                  <p className="text-sm text-error-500">{erroresCampo.correo}</p>
                )}
              </div>

              <div className="sm:col-span-1">
                <Label>
                  Celular<span className="text-error-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Número de celular"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                />
                {erroresCampo.celular && (
                  <p className="text-sm text-error-500">{erroresCampo.celular}</p>
                )}
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <Label>
                Contraseña<span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  placeholder="Ingresa tu contraseña"
                  type={showPassword ? "text" : "password"}
                  value={contraseña}
                  onChange={(e) => setContraseña(e.target.value)}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showPassword ? (
                    <EyeIcon className="fill-gray-200 " />
                  ) : (
                    <EyeCloseIcon className="fill-gray-200 " />
                  )}
                </span>
              </div>
              {erroresCampo.contraseña && (
                <p className="text-sm text-error-500">{erroresCampo.contraseña}</p>
              )}
            </div>

            <div>
              <Label>
                Confirmar Contraseña<span className="text-error-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  placeholder="Confirma tu contraseña"
                  type={showPassword ? "text" : "password"}
                  value={confirmarContraseña}
                  onChange={(e) => setConfirmarContraseña(e.target.value)}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                >
                  {showPassword ? (
                    <EyeIcon className="fill-gray-200 " />
                  ) : (
                    <EyeCloseIcon className="fill-gray-200 " />
                  )}
                </span>
              </div>
              {erroresCampo.contraseña && (
                <p className="text-sm text-error-500">{erroresCampo.contraseña}</p>
              )}
            </div>

            {/* Botón de envío */}
            <div>
              <Button className="w-full" size="sm" disabled={isLoading}>
                {isLoading ? "Registrando..." : "Registrarse"}
              </Button>
            </div>
          </div>
        </form>


        {/* Mensaje de error global */}
        {error && <p className="mt-4 text-sm text-center text-error-500">{error}</p>}
      </div>
    </div>
  );
}
"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!nombre || !direccion || !correo || !telefono || !contraseña) {
      setError("Todos los campos son obligatorios");
      setIsLoading(false);
      return;
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nombre, direccion, correo, telefono, contraseña }),
    });

    const data = await res.json();

    if (res.ok) {
      router.push("/");
    } else {
      setError(data.message || "Ocurrió un error al registrar la sucursal");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full overflow-y-auto no-scrollbar bg-[#0C0C0F]/95 p-6 rounded shadow max-w-lg">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-300 transition-colors hover:text-gray-400"
        >
          <ChevronLeftIcon />
          Volver al dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-25 text-title-sm sm:text-title-md text-center">
              Registrar Sucursal
            </h1>
            <p className="text-sm text-gray-200 text-center">
              ¡Enhorabuena! Una nueva sucursal se une a nuestra historia de éxito.
            </p>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>
                      Nombre<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="Nombre de la sucursal"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label>
                      Dirección<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="Dirección de la sucursal"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>
                      Correo<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="email"
                      placeholder="Correo de la sucursal"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label>
                      Teléfono<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      placeholder="Teléfono de la sucursal"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                  </div>
                </div>

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
                </div>

                {error && (
                  <p className="text-sm text-error-500 text-center">{error}</p>
                )}

                <div>
                  <Button className="w-full" size="sm" disabled={isLoading}>
                    {isLoading ? "Registrando..." : "Registrarse"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-300  sm:text-start">
                ¿Tienes una cuenta? {""}
                <Link
                  href="/"
                  className="text-brand-600 hover:text-brand-500"
                >
                  Iniciar Sesión
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

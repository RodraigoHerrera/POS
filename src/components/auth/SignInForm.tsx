"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [correo, setCorreo] = useState("");
  const [contraseña, setContraseña] = useState("");
  const [errorCorreo, setErrorCorreo] = useState("");
  const [errorContraseña, setErrorContraseña] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorCorreo("");
    setErrorContraseña("");
    setAuthError("");
    setIsLoading(true);

    let hasError = false;

    if (!correo) {
      setErrorCorreo("Debe rellenar este campo");
      hasError = true;
    }
    if (!contraseña) {
      setErrorContraseña("Debe rellenar este campo");
      hasError = true;
    }

    if (hasError) {
      setIsLoading(false);
      return;
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ correo, contraseña }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      const error = await res.json();
      setAuthError(error.message || "Error al iniciar sesión");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0C0C0F]/95 p-6 rounded shadow w-full max-w-lg">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/admin"
          className="inline-flex items-center text-sm text-gray-25 transition-colors hover:text-gray-400 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Back to dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-brand-500 text-title-sm text-center sm:text-title-md">
              SMASH POS
            </h1>
            <p className="text-sm text-brand-25 text-center">
              ¡Hoy es un gran día para marcar la diferencia!
            </p>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Correo <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    placeholder="info@gmail.com"
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                  />
                  {errorCorreo && (
                    <p className="mt-1 text-sm text-error-500">{errorCorreo}</p>
                  )}
                </div>
                <div>
                  <Label>
                    Contraseña <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingrese su contraseña"
                      value={contraseña}
                      onChange={(e) => setContraseña(e.target.value)}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-25 dark:fill-gray-400" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-25 dark:fill-gray-400" />
                      )}
                    </span>
                  </div>
                  {errorContraseña && (
                    <p className="mt-1 text-sm text-error-500">{errorContraseña}</p>
                  )}
                </div>
                {authError && (
                  <p className="text-sm text-error-500 text-center">{authError}</p>
                )}
                <div>
                  <Button className="w-full" size="sm" disabled={isLoading}>
                    {isLoading ? "Verificando..." : "Iniciar Sesión"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-25 dark:text-gray-400 sm:text-start">
                ¿No tienes una cuenta? {""}
                <Link
                  href="/signup"
                  className="text-brand-600 hover:text-brand-500 dark:text-brand-400"
                >
                  Regístrate
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
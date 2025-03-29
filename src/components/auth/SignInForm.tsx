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
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ correo, contraseña }),
    });

    if (res.ok) {
      console.log("Inicio de sesión exitoso");
      router.push("/admin");
    } else {
      const error = await res.json();
      console.error("Error al iniciar sesión:", error.message);
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
                </div>
                <div>
                  <Button className="w-full" size="sm">
                    Iniciar Sesión
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

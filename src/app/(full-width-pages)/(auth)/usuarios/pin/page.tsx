"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Suspense } from "react";
import { usuarioDesdeRespuestaPin } from "@/lib/empleadosKiosco";
import { rutaPorRol } from "@/lib/rutaPorRol";
import Link from "next/link";
import Button from "@/components/ui/button/Button";

function EmpleadoPinContent() {
  const [pin, setPin] = useState("");
  const [usuario, setUsuario] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  useEffect(() => {
    // Sin id válido o con un empleado inexistente/inactivo no hay a quién
    // pedirle el PIN: se vuelve a la selección de empleado
    if (!id) {
      router.replace("/usuarios");
      return;
    }

    const fetchUsuario = async () => {
      try {
        const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`);
        const nombreUsuario = res.ok ? usuarioDesdeRespuestaPin(await res.json()) : null;
        if (!nombreUsuario) {
          router.replace("/usuarios");
          return;
        }
        setUsuario(nombreUsuario);
      } catch (err) {
        console.error("Error al obtener el empleado:", err);
        router.replace("/usuarios");
      }
    };

    fetchUsuario();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
        const res = await fetch("/api/usuarios/id", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // 👈 importante si usas JWT con cookies
            body: JSON.stringify({ id, pin }),
          });
          

      const data = await res.json();

      if (res.ok) {
        const ruta = rutaPorRol(data.rol);
        if (ruta) router.push(ruta);
        else setError("Tu rol no tiene acceso a ninguna pantalla. Consulta con un administrador.");
      } else {
        setError(data.error || data.message || "PIN incorrecto");
      }
    } catch (error) {
      console.error("Error en login:", error);
      setError("Error en el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="w-full max-w-lg rounded-2xl bg-[#0C0C0F]/95 p-6 shadow sm:p-10">
      <div className="mb-5 text-center sm:mb-8">
        <h1 className="mb-2 text-title-sm font-semibold text-brand-500 break-all sm:text-title-md">
          {usuario ? `Hola, ${usuario}` : "\u00a0"}
        </h1>
        <p className="text-sm text-brand-25">Ingresa tu PIN para continuar</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sin inputMode numérico: los PIN actuales pueden tener letras */}
        <input
          type="password"
          autoComplete="off"
          autoFocus
          aria-label="PIN"
          aria-invalid={!!error}
          aria-describedby={error ? "pin-error" : undefined}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className={`h-11 w-full appearance-none rounded-lg border bg-gray-900 px-4 py-2.5 text-center text-lg tracking-[0.3em] text-white/90 shadow-theme-xs placeholder:tracking-normal placeholder:text-white/30 focus:outline-hidden focus:ring-3 ${
            error
              ? "border-error-500 focus:ring-error-500/10"
              : "border-gray-700 focus:border-brand-800 focus:ring-brand-500/10"
          }`}
          placeholder="PIN"
        />
        {error && (
          <p id="pin-error" role="alert" className="text-center text-sm text-error-500">
            {error}
          </p>
        )}
        <Button className="w-full" size="sm" disabled={isLoading || !pin}>
          {isLoading ? "Verificando..." : "Ingresar"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-gray-400">
        ¿No eres tú?{" "}
        <Link href="/usuarios" className="text-brand-600 hover:text-brand-500">
          Elige otro usuario
        </Link>
      </p>
    </main>
  );
}

export default function EmpleadoPin() {
  return (
    <Suspense fallback={<p role="status" className="text-sm text-gray-400">Cargando...</p>}>
      <EmpleadoPinContent />
    </Suspense>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Suspense } from "react";
import { usuarioDesdeRespuestaPin } from "@/lib/empleadosKiosco";
import { rutaPorRol } from "@/lib/rutaPorRol";

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
    <div className="min-h-screen flex items-center justify-center bg-[#0C0C0F]/98 p-6">
      <div className="bg-white/10 p-6 rounded-lg max-w-sm w-full text-center">
        <h2 className="text-xl font-semibold text-white mb-4">
          Hola, {usuario}
        </h2>
        <p className="text-white mb-4">Ingresa tu PIN para continuar</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sin inputMode numérico: los PIN actuales pueden tener letras */}
          <input
            type="password"
            autoComplete="off"
            autoFocus
            aria-label="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full px-4 py-2 rounded-md text-gray-100"
            placeholder="PIN"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={isLoading || !pin}
            className="w-full bg-brand-600 text-gray-950 font-bold py-2 rounded-md hover:bg-brand-20"
          >
            {isLoading ? "Verificando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function EmpleadoPin() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <EmpleadoPinContent />
    </Suspense>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function EmpleadoPin() {
  const [pin, setPin] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  useEffect(() => {
    const fetchNombre = async () => {
      try {
        const res = await fetch(`/api/usuarios/${id}`);
        const data = await res.json();
        setNombre(data.nombre);
      } catch (err) {
        console.error("Error al obtener nombre del empleado:", err);
      }
    };

    if (id) fetchNombre();
  }, [id]);

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
        if (data.rol === "Administrador") router.push("/admin?id");
        else if (data.rol === "Cajero") router.push("/cajero?id");
      } else {
        setError(data.message || "PIN incorrectooo");
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
          Hola, {nombre}
        </h2>
        <p className="text-white mb-4">Ingresa tu PIN para continuar</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
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

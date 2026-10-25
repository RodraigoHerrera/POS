"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { parsearEmpleadosKiosco, type EmpleadoKiosco } from "@/lib/empleadosKiosco";

export default function EmpleadoSelector() {
  const [empleados, setEmpleados] = useState<EmpleadoKiosco[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchEmpleados = async () => {
      try {
        // El endpoint ya devuelve solo empleados activos de la sucursal
        const res = await fetch("/api/usuarios/kiosco", {
          credentials: "include",
        });
        const lista = res.ok ? parsearEmpleadosKiosco(await res.json()) : null;
        if (!lista) {
          setError("No se pudo cargar la lista de empleados. Recarga la página.");
          return;
        }
        setEmpleados(lista);
      } catch (error) {
        console.error("Error al obtener empleados:", error);
        setError("No se pudo cargar la lista de empleados. Recarga la página.");
      }
    };
    fetchEmpleados();
  }, []);

  const colores = ["bg-brand-20", "bg-brand-600"];

  if (error) {
    return <p className="text-center text-red-500">{error}</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
      {empleados.map((empleado, index) => (
        <div
          key={empleado.id}
          className={`rounded-2xl p-3 cursor-pointer transition-transform hover:scale-105 ${
            colores[index % colores.length]
          }`}
          onClick={() => router.push(`/usuarios/pin?id=${empleado.id}`)}
        >
          <Image
            src={empleado.fotoUrl}
            alt={empleado.usuario}
            width={300}
            height={300}
            className="rounded-md w-full h-auto object-cover"
          />
          <p className="text-center font-mono text-lg mt-2">
            {empleado.usuario} <br /> {empleado.rol}
          </p>
        </div>
      ))}
    </div>
  );
}
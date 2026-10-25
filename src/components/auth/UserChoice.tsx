"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  estadoSeleccionEmpleados,
  parsearEmpleadosKiosco,
  rutaPinEmpleado,
  type EstadoSeleccion,
} from "@/lib/empleadosKiosco";

export default function EmpleadoSelector() {
  // null mientras carga la lista
  const [estado, setEstado] = useState<EstadoSeleccion | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchEmpleados = async () => {
      try {
        // El endpoint ya devuelve solo empleados activos de la sucursal
        const res = await fetch("/api/usuarios/kiosco", {
          credentials: "include",
        });
        const lista = res.ok ? parsearEmpleadosKiosco(await res.json()) : null;
        setEstado(estadoSeleccionEmpleados(lista));
      } catch (error) {
        console.error("Error al obtener empleados:", error);
        setEstado(estadoSeleccionEmpleados(null));
      }
    };
    fetchEmpleados();
  }, []);

  const colores = ["bg-brand-20", "bg-brand-600"];

  if (!estado) {
    return (
      <p role="status" className="text-center text-gray-300">
        Cargando empleados...
      </p>
    );
  }

  if (estado.tipo === "error") {
    return (
      <p role="alert" className="text-center text-red-500">
        No se pudo cargar la lista de empleados. Recarga la página.
      </p>
    );
  }

  if (estado.tipo === "vacio") {
    return (
      <p role="status" className="text-center text-gray-300">
        No hay empleados activos en esta sucursal. Pide a un administrador que los registre.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
      {estado.empleados.map((empleado, index) => (
        <button
          type="button"
          key={empleado.id}
          className={`rounded-2xl p-3 cursor-pointer transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
            colores[index % colores.length]
          }`}
          onClick={() => router.push(rutaPinEmpleado(empleado.id))}
        >
          {/* Decorativa: el nombre visible ya da el nombre accesible del botón */}
          <Image
            src={empleado.fotoUrl}
            alt=""
            width={300}
            height={300}
            className="rounded-md w-full h-auto object-cover"
          />
          <span className="block text-center font-mono text-lg mt-2">
            {empleado.usuario} <br /> {empleado.rol}
          </span>
        </button>
      ))}
    </div>
  );
}

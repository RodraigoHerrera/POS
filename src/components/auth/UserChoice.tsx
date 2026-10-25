"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import {
  esFotoPorDefecto,
  estadoSeleccionEmpleados,
  inicialesEmpleado,
  parsearEmpleadosKiosco,
  rutaPinEmpleado,
  type EstadoSeleccion,
} from "@/lib/empleadosKiosco";

const TARJETAS_ESQUELETO = 4;
const GRILLA = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-6";

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

  if (!estado) {
    return (
      <div role="status">
        <span className="sr-only">Cargando empleados...</span>
        <div className={GRILLA} aria-hidden="true">
          {Array.from({ length: TARJETAS_ESQUELETO }, (_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-4 rounded-2xl border border-gray-800 p-5"
            >
              <Skeleton className="h-20 w-20 rounded-lg bg-white/10!" />
              <Skeleton className="h-5 w-24 bg-white/10!" />
              <Skeleton className="h-5 w-16 rounded-full bg-white/10!" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-sm text-error-500">
          No se pudo cargar la lista de empleados.
        </p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (estado.tipo === "vacio") {
    return (
      <p role="status" className="py-6 text-center text-sm text-gray-400">
        No hay empleados activos en esta sucursal. Pide a un administrador que los registre.
      </p>
    );
  }

  return (
    <div className={GRILLA}>
      {estado.empleados.map((empleado) => (
        <button
          type="button"
          key={empleado.id}
          className="group flex flex-col items-center gap-4 rounded-2xl border border-gray-800 bg-white/[0.03] p-5 text-center transition hover:border-brand-500 hover:bg-white/[0.06] focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/30"
          onClick={() => router.push(rutaPinEmpleado(empleado.id))}
        >
          {/* Decorativa: el nombre visible ya da el nombre accesible del botón */}
          <span
            aria-hidden="true"
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-800 bg-brand-500/15 text-2xl font-semibold text-brand-400 transition group-hover:border-brand-500"
          >
            {esFotoPorDefecto(empleado.fotoUrl) ? (
              inicialesEmpleado(empleado.usuario)
            ) : (
              <Image
                src={empleado.fotoUrl}
                alt=""
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <span className="block text-lg font-bold text-white/90 break-all">
            {empleado.usuario}
          </span>
          <Badge size="sm" color="warning">
            {empleado.rol}
          </Badge>
        </button>
      ))}
    </div>
  );
}

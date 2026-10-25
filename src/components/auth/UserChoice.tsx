"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import type { EmpleadoKiosco } from "@/lib/empleadosKiosco";

export default function EmpleadoSelector() {
  const [empleados, setEmpleados] = useState<EmpleadoKiosco[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchEmpleados = async () => {
      try {
        // El endpoint ya devuelve solo empleados activos de la sucursal
        const res = await fetch("/api/usuarios/kiosco", {
          credentials: "include",
        });
        const data = await res.json();
        setEmpleados(data);
      } catch (error) {
        console.error("Error al obtener empleados:", error);
      }
    };
    fetchEmpleados();
  }, []);

  const colores = ["bg-brand-20", "bg-brand-600"];

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
"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Empleado {
  id: number;
  nombre: string;
  fotoUrl: string;
  rol: string;
  estado: string;
}

export default function EmpleadoSelector() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchEmpleados = async () => {
      try {
        const res = await fetch("/api/usuarios", {
          credentials: "include",
        });
        const data = await res.json();
        setEmpleados(data);
        console.log(data);
      } catch (error) {
        console.error("Error al obtener empleados:", error);
      }
    };
    fetchEmpleados();
  }, []);

  const colores = ["bg-brand-20", "bg-brand-600"];

  // Filtrar solo empleados activos
  const empleadosActivos = empleados.filter(empleado => empleado.estado === "Activo");

  return (
    
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
      {empleadosActivos.map((empleado, index) => (
        <div
          key={empleado.id}
          className={`rounded-2xl p-3 cursor-pointer transition-transform hover:scale-105 ${
            colores[index % colores.length]
          }`}
          onClick={() => router.push(`/usuarios/pin?id=${empleado.id}`)}
        >
          <Image
            src={empleado.fotoUrl}
            alt={empleado.nombre}
            width={300}
            height={300}
            className="rounded-md w-full h-auto object-cover"
          />
          <p className="text-center font-mono text-lg mt-2">
            {empleado.nombre} <br /> {empleado.rol}
          </p>
        </div>
      ))}
    </div>
    
  );
}
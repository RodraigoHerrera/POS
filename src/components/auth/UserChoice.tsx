"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Empleado {
  id: number;
  nombre: string;
  fotoUrl: string;
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
      } catch (error) {
        console.error("Error al obtener empleados:", error);
      }
    };
    fetchEmpleados();
  }, []);

  const colores = ["bg-brand-20", "bg-brand-600"];

  return (
    <div className="min-h-screen w-full bg-[#0C0C0F]/90 p-6">
      <h1 className="text-center text-4xl font-bold text-brand-20 mb-10">
        ¿QUIÉN ERES?
      </h1>
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
              alt={empleado.nombre}
              width={300}
              height={300}
              className="rounded-md w-full h-auto object-cover"
            />
            <p className="text-center font-mono text-lg mt-2">
              {empleado.nombre}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

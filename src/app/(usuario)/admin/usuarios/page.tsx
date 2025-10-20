"use client";
import UserMetaCard from "@/components/user-profile/UserMetaCard";
import React, { useEffect, useState } from "react";

interface Empleado {
  id: number;
  nombre: string;
  fotoUrl: string;
  rol: string;
  estado: string;
  correo: string;
  celular: string;
  creado: string;
}

export default function usuariosSucursal() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
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
  return (
      <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] space-y-10 sm:space-y-6">
        <h1 className="text-center mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
          USUARIOS DE LA SUCURSAL
        </h1>
        <div>
          {empleados.map((empleado) => ( 
            <UserMetaCard
                key={empleado.id}
                userData={empleado}
             />
          ))}
          
        </div>
      </div>
    );
}

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
      <div className="min-h-screen w-full bg-[#E5E1E1]/90 p-6 rounded-2xl">
        <h1 className="text-center text-4xl font-bold text-brand-20 mb-10">
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

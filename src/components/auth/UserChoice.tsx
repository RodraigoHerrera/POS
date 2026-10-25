"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  esFotoPorDefecto,
  estadoSeleccionEmpleados,
  inicialesEmpleado,
  numeroTicket,
  parsearEmpleadosKiosco,
  rutaPinEmpleado,
  type EstadoSeleccion,
} from "@/lib/empleadosKiosco";
import styles from "./kiosco.module.css";

const TICKETS_ESQUELETO = 4;

function Aviso({
  codigo,
  titulo,
  texto,
  role,
  accion,
}: {
  codigo: string;
  titulo: string;
  texto: string;
  role: "alert" | "status";
  accion?: React.ReactNode;
}) {
  return (
    <div role={role} className={styles.aviso}>
      <div className={styles.comanda}>
        <span className={styles.pinza} aria-hidden="true" />
        <div className={styles.papel}>
          <span className={`${styles.display} ${styles.avisoCodigo}`} aria-hidden="true">
            {codigo}
          </span>
          <p className={`${styles.display} ${styles.avisoTitulo}`}>{titulo}</p>
          <p className={styles.avisoTexto}>{texto}</p>
          {accion}
        </div>
      </div>
    </div>
  );
}

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
        <ul className={styles.comandas} aria-hidden="true">
          {Array.from({ length: TICKETS_ESQUELETO }, (_, i) => (
            <li
              key={i}
              className={`${styles.comandaItem} ${styles.esqueleto}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className={styles.comanda}>
                <span className={styles.pinza} />
                <div className={styles.papel}>
                  <span className={styles.avatar} />
                  <span className={styles.barra} />
                  <span className={styles.barra} style={{ width: "40%" }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <Aviso
        role="alert"
        codigo="86"
        titulo="Sin conexión con la cocina"
        texto="No se pudo cargar la lista de empleados."
        accion={
          <button
            type="button"
            className={`${styles.mono} ${styles.botonTinta}`}
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        }
      />
    );
  }

  if (estado.tipo === "vacio") {
    return (
      <Aviso
        role="status"
        codigo="0"
        titulo="Nadie en el riel"
        texto="No hay empleados activos en esta sucursal. Pide a un administrador que los registre."
      />
    );
  }

  return (
    <ul className={styles.comandas}>
      {estado.empleados.map((empleado, index) => (
        <li
          key={empleado.id}
          className={styles.comandaItem}
          style={{ "--i": index } as React.CSSProperties}
        >
          <button
            type="button"
            className={styles.comanda}
            onClick={() => router.push(rutaPinEmpleado(empleado.id))}
          >
            <span className={styles.pinza} aria-hidden="true" />
            <span className={styles.papel}>
              <span className={`${styles.mono} ${styles.comandaCabecera}`} aria-hidden="true">
                <span>{numeroTicket(index)}</span>
                <span>En turno</span>
              </span>
              {/* Decorativa: el nombre visible ya da el nombre accesible del botón */}
              <span className={`${styles.display} ${styles.avatar}`} aria-hidden="true">
                {esFotoPorDefecto(empleado.fotoUrl) ? (
                  inicialesEmpleado(empleado.usuario)
                ) : (
                  <Image src={empleado.fotoUrl} alt="" width={300} height={300} />
                )}
              </span>
              <span className={`${styles.display} ${styles.nombre}`}>{empleado.usuario}</span>
              <span className={`${styles.mono} ${styles.sello}`}>{empleado.rol}</span>
              <span className={`${styles.mono} ${styles.comandaPie}`} aria-hidden="true">
                <span>Ingresar</span>
                <span className={styles.flecha}>→</span>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Suspense } from "react";
import { usuarioDesdeRespuestaPin } from "@/lib/empleadosKiosco";
import { rutaPorRol } from "@/lib/rutaPorRol";
import Link from "next/link";
import styles from "@/components/auth/kiosco.module.css";

function EmpleadoPinContent() {
  const [pin, setPin] = useState("");
  const [usuario, setUsuario] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  useEffect(() => {
    // Sin id válido o con un empleado inexistente/inactivo no hay a quién
    // pedirle el PIN: se vuelve a la selección de empleado
    if (!id) {
      router.replace("/usuarios");
      return;
    }

    const fetchUsuario = async () => {
      try {
        const res = await fetch(`/api/usuarios/${encodeURIComponent(id)}`);
        const nombreUsuario = res.ok ? usuarioDesdeRespuestaPin(await res.json()) : null;
        if (!nombreUsuario) {
          router.replace("/usuarios");
          return;
        }
        setUsuario(nombreUsuario);
      } catch (err) {
        console.error("Error al obtener el empleado:", err);
        router.replace("/usuarios");
      }
    };

    fetchUsuario();
  }, [id, router]);

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
        const ruta = rutaPorRol(data.rol);
        if (ruta) router.push(ruta);
        else setError("Tu rol no tiene acceso a ninguna pantalla. Consulta con un administrador.");
      } else {
        setError(data.error || data.message || "PIN incorrecto");
      }
    } catch (error) {
      console.error("Error en login:", error);
      setError("Error en el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className={styles.pinPagina}>
      <div className={styles.pinComanda}>
        <div className={styles.comanda}>
          <span className={styles.pinza} aria-hidden="true" />
          <div className={styles.papel}>
            <span className={`${styles.mono} ${styles.comandaCabecera}`} aria-hidden="true">
              <span>Comanda de ingreso</span>
              <span>PIN</span>
            </span>
            <div>
              <p className={`${styles.mono} ${styles.pinSaludo}`}>Hola,</p>
              <h1 className={`${styles.display} ${styles.pinNombre}`}>{usuario || " "}</h1>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Sin inputMode numérico: los PIN actuales pueden tener letras */}
              <input
                type="password"
                autoComplete="off"
                autoFocus
                aria-label="PIN"
                aria-invalid={!!error}
                aria-describedby={error ? "pin-error" : undefined}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={`${styles.mono} ${styles.pinInput}`}
                placeholder="PIN"
              />
              {error && (
                <p id="pin-error" role="alert" className={styles.pinError}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoading || !pin}
                className={`${styles.display} ${styles.pinBoton}`}
              >
                {isLoading ? "Verificando..." : "Ingresar"}
              </button>
            </form>
          </div>
        </div>
        <div className="text-center">
          <Link href="/usuarios" className={`${styles.mono} ${styles.volver}`}>
            ← No soy yo
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function EmpleadoPin() {
  return (
    <Suspense
      fallback={
        <p role="status" className={`${styles.mono} ${styles.pinPagina}`}>
          Cargando...
        </p>
      }
    >
      <EmpleadoPinContent />
    </Suspense>
  );
}

"use client";
import { useEffect, useState } from "react";
import styles from "./kiosco.module.css";

export default function RelojTurno() {
  // null hasta montar: la hora del servidor no coincide con la del cliente
  const [ahora, setAhora] = useState<Date | null>(null);

  useEffect(() => {
    setAhora(new Date());
    const intervalo = setInterval(() => setAhora(new Date()), 15_000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className={styles.reloj} aria-hidden="true">
      <div className={`${styles.display} ${styles.relojHora}`}>
        {ahora ? ahora.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
      </div>
      <div className={`${styles.mono} ${styles.relojFecha}`}>
        {ahora
          ? ahora.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "short" })
          : " "}
      </div>
    </div>
  );
}

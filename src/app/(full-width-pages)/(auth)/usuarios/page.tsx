import UserChoice from "@/components/auth/UserChoice";
import RelojTurno from "@/components/auth/RelojTurno";
import styles from "@/components/auth/kiosco.module.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Selección de empleado",
  description: "Elige tu usuario para ingresar con tu PIN",
};

export default function Usuarios() {
  return (
    <main className={styles.pagina}>
      <header className={styles.cabecera}>
        <div>
          <p className={`${styles.mono} ${styles.eyebrow}`}>Inicio de turno</p>
          <h1 className={`${styles.display} ${styles.titulo}`}>
            ¿Quién está <br />
            <em>en turno?</em>
          </h1>
        </div>
        <RelojTurno />
      </header>
      <div className={styles.riel} aria-hidden="true" />
      <UserChoice />
      <p className={`${styles.mono} ${styles.instruccion}`}>
        Toca tu comanda para ingresar con tu PIN
      </p>
    </main>
  );
}

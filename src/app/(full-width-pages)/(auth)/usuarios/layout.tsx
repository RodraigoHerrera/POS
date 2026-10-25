import { Anton, JetBrains_Mono } from "next/font/google";
import styles from "@/components/auth/kiosco.module.css";

const display = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-kiosco-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-kiosco-mono",
});

export default function UsuariosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${mono.variable} ${styles.escena}`}>{children}</div>
  );
}

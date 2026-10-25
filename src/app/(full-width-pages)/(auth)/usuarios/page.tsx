import UserChoice from "@/components/auth/UserChoice";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Selección de empleado",
  description: "Elige tu usuario para ingresar con tu PIN",
};

export default function Usuarios() {
  return (
    <div className="min-h-screen w-full bg-[#0C0C0F]/90 p-6">
      <h1 className="text-center text-4xl font-bold text-brand-20 mb-10">
        ¿QUIÉN ERES?
      </h1>
      <UserChoice />
    </div>
  );
}

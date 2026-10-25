import UserChoice from "@/components/auth/UserChoice";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Selección de empleado",
  description: "Elige tu usuario para ingresar con tu PIN",
};

export default function Usuarios() {
  return (
    <main className="w-full max-w-6xl rounded-2xl bg-[#0C0C0F]/95 p-6 shadow sm:my-10 sm:p-10">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-title-sm font-semibold text-brand-500 sm:text-title-md">
          ¿Quién eres?
        </h1>
        <p className="text-sm text-brand-25">Elige tu usuario para ingresar con tu PIN</p>
      </div>
      <UserChoice />
    </main>
  );
}

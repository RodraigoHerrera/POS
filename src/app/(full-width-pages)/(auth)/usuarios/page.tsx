import UserChoice from "@/components/auth/UserChoice";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js SignUp Page | TailAdmin - Next.js Dashboard Template",
  description: "This is Next.js SignUp Page TailAdmin Dashboard Template",
  // other metadata
};

export default function usuarios() {
  return (
    <div className="min-h-screen w-full bg-[#0C0C0F]/90 p-6">
      <h1 className="text-center text-4xl font-bold text-brand-20 mb-10">
        ¿QUIÉN ERES?
      </h1>
      <UserChoice />
    </div>
  );
}

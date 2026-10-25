import AdminForm from "@/components/auth/AdminForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Next.js SignUp Page | TailAdmin - Next.js Dashboard Template",
  description: "This is Next.js SignUp Page TailAdmin Dashboard Template",
  // other metadata
};

import { Suspense } from "react";

export default function newAdmin() {
   return (
     <Suspense fallback={<div>Cargando...</div>}>
       <AdminForm />
     </Suspense>
   );
}
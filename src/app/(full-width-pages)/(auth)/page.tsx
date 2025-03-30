import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inicio de Sesión",
  description: "Inicio de Sesión para las sucursales de Smash",
};

export default function SignIn() {
  return <SignInForm />;
}

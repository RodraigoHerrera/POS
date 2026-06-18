import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ message: "Sesión cerrada" });
  res.cookies.set("tokenSucursal", "", { path: "/", maxAge: 0 });
  res.cookies.set("tokenEmpleado", "", { path: "/", maxAge: 0 });
  return res;
}

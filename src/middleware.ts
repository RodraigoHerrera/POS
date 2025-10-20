// middleware.ts
export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/admin/:path*",
    "/admin",
    "/cajero/:path*", 
    "/cajero",
    "/usuarios/:path*",
    "/usuarios",
  ],
}
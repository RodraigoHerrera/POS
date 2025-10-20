// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import bcrypt from 'bcrypt'

// Define el tipo directamente
type User = {
  id: string
  email: string
  name?: string
}

declare module "next-auth" {
  interface Session {
    user: User
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    email: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        correo: { label: 'Correo', type: 'email' },
        contraseña: { label: 'Contraseña', type: 'password' }
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.correo || !credentials?.contraseña) {
          return null
        }

        try {
          const sucursal = await prisma.sucursales.findUnique({
            where: { correo: credentials.correo },
          })

          if (!sucursal) {
            return null
          }

          const passwordMatch = await bcrypt.compare(
            credentials.contraseña, 
            sucursal.contrasena
          )

          if (!passwordMatch) {
            return null
          }

          return {
            id: sucursal.id.toString(),
            email: sucursal.correo,
            name: sucursal.nombre,
          }
        } catch (error) {
          console.error('Error en authorize:', error)
          return null
        }
      }
    })
  ],
  // ... resto de la configuración igual
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
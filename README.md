# Smash POS

Sistema POS/ERP ligero para restaurantes fast‑casual (Smash Burguer). Este repositorio contiene la **app web** (Next.js + Prisma + MySQL) y el **API** basado en rutas de App Router.

> **Estado:** en desarrollo activo. README ajustado según configuración confirmada (Node v20.18.0, npm, MySQL, JWT/Sesiones).

---

## 🧭 Tabla de contenidos

* [Arquitectura & Stack](#arquitectura--stack)
* [Requisitos previos](#requisitos-previos)
* [Instalación rápida](#instalación-rápida)
* [Configuración de entorno](#configuración-de-entorno)
* [Base de datos (Prisma)](#base-de-datos-prisma)
* [Ejecución](#ejecución)
* [Build y despliegue](#build-y-despliegue)
* [Estructura de carpetas](#estructura-de-carpetas)
* [Flujo de autenticación (modelo POS)](#flujo-de-autenticación-modelo-pos)
* [API (ejemplos)](#api-ejemplos)
* [Estándares de código](#estándares-de-código)
* [Contribución](#contribución)
* [Solución de problemas](#solución-de-problemas)
* [Licencia](#licencia)

---

## Arquitectura & Stack

* **Frontend / Full‑stack:** Next.js (App Router, TypeScript, React Server Components).
* **ORM:** Prisma.
* **BD:** MySQL 8.x.
* **Auth:** Login por **Sucursal** → selección de **Empleado** → **PIN**; sesiones basadas en **JWT**.
* **Estilos/UI:** TailwindCSS + componentes propios.

> **Nota:** Cada **Sucursal** actúa como “usuario” para el login inicial. Tras seleccionar el **Empleado** y validar **PIN**, se enruta según rol.

---

## Requisitos previos

* **Node.js:** v20.18.0
* **Gestor de paquetes:** npm
* **Git** ≥ 2.30
* **MySQL** 8.x
* **OpenSSL** (para generar secretos)

---

## Instalación rápida

```bash
# 1) Clonar
git clone <URL-del-repo> smash-pos
cd smash-pos

# 2) Instalar dependencias
npm install --legacy-peer-deps

# 3) Crear .env
cp .env.example .env  # o copia manual

# 4) Preparar Prisma
npx prisma generate

# 5) Crear BD y migrar
npx prisma migrate dev --name init

# 6) Ejecutar en desarrollo
npm run dev

Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

winget install Schniz.fnm

fnm install 22
```

---

## Configuración de entorno

Crea `.env` en la raíz del proyecto. Variables típicas:

```dotenv
DATABASE_URL="mysql://usuario:clave@localhost:3306/smash_pos"

# Sesiones/JWT
JWT_SECRET="<genera-un-secreto>"
SESSION_EXPIRATION_HOURS=12

# App
NODE_ENV="development"
PORT=3000
```

> Generar secreto rápido: `openssl rand -base64 32`

Incluye un `.env.example` versionado con **placeholders**, nunca subas credenciales reales.

---

## Base de datos (Prisma)

### Modelos principales

* `Sucursal`, `Empleado` *(login por sucursal, selección de empleado, PIN y rol)*
* `Inventario` (productos/insumos por sucursal)
* `Factura`, `Cliente`, `Caja`, `Turno` *(planeado/implementándose)*

### Comandos útiles

```bash
npx prisma generate
npx prisma migrate dev --name <cambio>
npx prisma studio
## Comandos Prisma

npx prisma init

npx prisma migrate dev --name init

Si se edita
npx prisma migrate dev --name add_estado_a_empleado 



npx prisma migrate dev
```

---

## Ejecución

### Desarrollo

```bash
npm run dev
```

Accede a `http://localhost:3000`.

### Producción (local)

```bash
npm run build
npm start
```

---

## Build y despliegue

1. **Build:** `npm run build`
2. **Entorno:** define `.env` seguro en el servidor.
3. **Migraciones:** `npx prisma migrate deploy` antes de levantar.
4. **Ejecución:** `npm start` detrás de un reverse proxy (Nginx/Caddy) con HTTPS.

---

## Estructura de carpetas

```
src/
  app/
    api/
      usuarios/
        modificar/route.ts
      inventario/
        items/route.ts
  lib/
    db.ts            # instancia PrismaClient
  components/
  hooks/
prisma/
  schema.prisma
  seed.ts
public/
```

---

## Flujo de autenticación (modelo POS)

1. **Login Sucursal** (correo/contraseña de la sucursal).
2. Vista con **empleados de esa sucursal** (foto + nombre).
3. **PIN del empleado** → verificación.
4. Redirección por **rol**: `/admin` o `/cajero`.

Sesiones se manejan con **JWT**. Cada token tiene duración controlada según el entorno.

---

## API (ejemplos)

### Crear ítem de inventario (POST)

```
POST /api/inventario/items
{
  "sucursal_id": 1,
  "codigo": "ING-001",
  "nombre": "Carne 100g",
  "unidad": "kg",
  "costo_unitario": 23.50
}
```

Respuesta: `201 Created`.

### Actualizar usuario (PUT)

```
PUT /api/usuarios/modificar
{
  "id": 123,
  "nombre": "Juan Pérez",
  "rol": "cajero",
  "estado": "activo"
}
```

Respuesta: `200 OK` con usuario actualizado.

> ⚠️ Si tu modelo usa `BigInt`, conviértelo a string antes de `NextResponse.json()`.

---

## Estándares de código

* **TypeScript estricto.**
* **ESLint + Prettier.**
* **Commits:** formato [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).

---

## Contribución

1. Crear un **issue** con descripción del cambio.
2. Desarrollar en rama `feature/<nombre>`.
3. Verificar build y lint.
4. Abrir **PR** a `develop`.

---

## Solución de problemas

**P1012 relaciones Prisma**

> “missing an opposite relation field…” → agrega el campo inverso y corre `prisma format`.

**`TypeError: Do not know how to serialize a BigInt`**

> Convierte BigInt a string antes de devolver JSON.

---

## Licencia

A definir (MIT/propietaria).

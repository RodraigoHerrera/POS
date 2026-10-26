# Backups de Base de Datos — Smash POS

Este directorio almacena respaldos completos de la base de datos MySQL (estructura DDL y datos DML).

## Respaldo actual

- **Archivo:** `smash_backup_2026-10-23.sql`
- **Fecha:** 2026-10-23
- **Motor:** MySQL 8.x (InnoDB)
- **Base de datos:** `smash`
- **Contenido:**
  - Migraciones de Prisma (`_prisma_migrations`)
  - Configuración institucional (`sucursales`, `empleados`, `proveedor`)
  - Catálogo de productos e inventario (`producto`, `item`, `receta`, `recetaItem`)
  - Ventas, comandas y cajas (`caja`, `pedido`, `pedidoItem`, `factura`, `historialVentas`)

## Cómo restaurar el respaldo

Desde la terminal o consola de comandos:

```bash
# 1. Crear la base de datos si no existe
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS smash CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Importar el archivo SQL
mysql -u root -p smash < backup/smash_backup_2026-10-23.sql
```

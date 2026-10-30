# PRD — Smash POS

| Campo | Valor |
|-------|-------|
| Producto | Smash POS (paquete `oa-pos`) |
| Versión del documento | 1.0 |
| Fecha | 2026-10-29 |
| Estado | En desarrollo activo |
| Responsable | Rodrigo Herrera |

---

## 1. Resumen

Smash POS es un sistema POS/ERP ligero para restaurantes *fast-casual* (caso inicial: Smash Burguer). Unifica en una sola aplicación web la toma de pedidos y el cobro en caja, el control de inventario con lotes y caducidad (FEFO), las recetas y su costeo, la producción de preparados, la planificación de compras (MRP) y los reportes de ventas y márgenes, todo por sucursal.

## 2. Problema

Los restaurantes pequeños y medianos suelen operar con herramientas desconectadas: un POS que solo cobra, planillas de Excel para el inventario y compras hechas "a ojo". Esto provoca:

- **Descuadres de caja** sin trazabilidad de quién cobró qué ni por qué medio.
- **Desconocimiento del costo real** de cada plato y de la brecha entre costo real y teórico (merma, sobreporcionamiento).
- **Quiebres de stock o sobrecompras** por falta de pronóstico de demanda.
- **Pérdidas por caducidad** al no consumir primero los lotes que vencen antes.
- **Reportes manuales** y lentos para la toma de decisiones.

## 3. Objetivos

| # | Objetivo | Indicador de éxito |
|---|----------|--------------------|
| O1 | Cobro rápido y sin errores en caja | Registro de pedido + cobro en menos de 60 s; diferencia de cierre de caja trazable al 100 % |
| O2 | Inventario confiable por sucursal | Todo movimiento registrado en el kardex con empleado, motivo y lote |
| O3 | Conocer el margen real por producto | Cada venta guarda costo real (FEFO) y costo teórico (receta) |
| O4 | Compras planificadas | Corridas MRP que sugieren necesidades netas y fechas de emisión de OC |
| O5 | Decisiones basadas en datos | Reportes de ventas exportables a CSV compatibles con Excel en español |

### Fuera de alcance (por ahora)

- Facturación electrónica en línea con el SIN (los campos `cuf` y `url_sin` existen, pero la integración no está implementada).
- Aplicación móvil nativa y modo sin conexión.
- Delivery / integración con plataformas de terceros.
- Contabilidad general y nómina.
- Multimoneda.

## 4. Usuarios y roles

| Rol | Descripción | Necesidades principales |
|-----|-------------|-------------------------|
| **Sucursal** | Cuenta de acceso del local (correo + contraseña). Actúa como "usuario" del login inicial. | Habilitar el dispositivo del local para que los empleados elijan su perfil. |
| **Administrador** | Dueño o encargado. | Gestionar menú, recetas, inventario, usuarios, MRP y producción; revisar ventas y reportes; anular ventas y entradas. |
| **Cajero / Mesero** | Personal de piso. | Abrir caja, tomar y comandar pedidos, cobrar con múltiples métodos de pago, registrar movimientos de efectivo y cerrar caja. |

### Flujo de acceso

1. Login de **sucursal** (correo/contraseña).
2. Pantalla tipo kiosco con los **empleados** activos de la sucursal.
3. Validación de **PIN** del empleado.
4. Redirección por rol a `/admin` o `/cajero`. La sesión se mantiene con JWT de duración configurable.

## 5. Requisitos funcionales

### 5.1 Autenticación y usuarios
- RF-01: Registro del primer administrador y de sucursales.
- RF-02: Login por sucursal → selección de empleado → PIN.
- RF-03: Alta, edición, activación/desactivación de empleados con rol.
- RF-04: Cierre de sesión y expiración de token.
- RF-05: Límite de intentos de login por IP (respetando `TRUST_PROXY` detrás de un proxy inverso).

### 5.2 Caja
- RF-10: Apertura de caja con saldo inicial; una caja abierta por empleado.
- RF-11: Registro de movimientos manuales de efectivo (ingreso/egreso con descripción). Solo los de origen `MANUAL` cuentan como entradas/salidas de efectivo; `VENTA` y `ANULACION` son automáticos.
- RF-12: Cierre de caja con conteo de efectivo y montos declarados de tarjeta (lote POS) y QR; el sistema calcula diferencias (real − sistema) por método.
- RF-13: Resumen de caja con desglose por método de pago (efectivo, tarjeta, QR, transferencia, gift card, otros).
- RF-14: Ticket de cierre imprimible.

### 5.3 Pedidos (comandas)
- RF-20: Crear pedido con mesa/modalidad (mesa, barra, para llevar), cliente y observaciones.
- RF-21: Agregar productos con modificadores/extras (con precio adicional).
- RF-22: Ciclo de estados: `PENDIENTE → COMANDADO → PREPARADO → ENTREGADO → PAGADO`, o `ANULADO`.
- RF-23: Editar y anular pedidos abiertos.
- RF-24: Listado de pedidos abiertos por sucursal.

### 5.4 Cobro y facturación
- RF-30: Cobro del pedido asociándolo a la caja abierta.
- RF-31: Emisión de factura con razón social, NIT/CI, método de pago y **snapshot** de ítems y precios al momento de la venta.
- RF-32: Al cobrar, descontar insumos del inventario según receta, consumiendo lotes por FEFO.
- RF-33: Registrar en `historialVentas` precio, costo real (FEFO), costo teórico (receta) y margen por línea.

### 5.5 Catálogo, menú y recetas
- RF-40: Ítems tipificados: `vendible`, `insumo`, `prep` (preparado), `oficina`.
- RF-41: Productos de menú con categoría, descripción, imagen y visibilidad (búsqueda, filtros y alternancia rápida de visibilidad).
- RF-42: Recetas (BOM) multinivel por producto vendible y preparado.
- RF-43: Costo teórico de receta calculado en lote (sin consultas N+1), usando `costo_estandar` si existe o el costo promedio en caso contrario.
- RF-44: Modificadores de producto ligados a insumos.

### 5.6 Inventario
- RF-50: Inventario por sucursal con stock y costo promedio.
- RF-51: Registro de entradas (compras) por lote con código, caducidad, cantidad, costo unitario y costo total.
- RF-52: Edición auditada de entradas (una fila de auditoría por campo modificado) y anulación de entradas.
- RF-53: Registro de mermas.
- RF-54: Kardex con tipo (`Entrada`, `Salida`, `Ajuste`), motivo (`Compra`, `Venta`, `Merma`, `Produccion`, `Ajuste`, `Traslado`), lote y empleado responsable; filtros por rango de fechas y exportación a CSV.
- RF-55: Carga masiva de ítems por CSV con plantilla descargable; exportación del catálogo a CSV.
- RF-56: Gestión de proveedores; lead time y vida útil por ítem.
- RF-57: Movimientos mensuales de inventario.

### 5.7 Producción
- RF-60: Registrar producciones de preparados (`prep`) que consumen insumos y generan stock del preparado.
- RF-61: Alertas de insumos críticos para producción.

### 5.8 MRP (planificación de compras)
- RF-70: Ejecutar una corrida MRP por sucursal con horizonte en días y método de pronóstico (suavización exponencial o promedio móvil).
- RF-71: Pronóstico de demanda por producto con MAPE y cantidad MPS.
- RF-72: Explosión multinivel de recetas y cálculo de necesidad neta = bruta − stock − entradas programadas + stock de seguridad.
- RF-73: Fecha sugerida de emisión de OC según lead time; respeto de la vida útil del insumo.
- RF-74: Generar órdenes de compra desde la corrida sin duplicar compras.
- RF-75: Historial y detalle de corridas.

### 5.9 Ventas y reportes
- RF-80: Dashboard con ventas del periodo (selector de periodo), cantidad de ventas, top productos, venta mensual y costo de producción.
- RF-81: Listado de ventas con detalle y anulación por administrador.
- RF-82: Reportes de ventas por usuario, caja, producto y anulaciones, con vista previa en tabla (máx. 500 filas) y descarga CSV (separador `;` y coma decimal para Excel en español).
- RF-83: Filtros de fecha con selector de rango compartido en español.

## 6. Requisitos no funcionales

| Categoría | Requisito |
|-----------|-----------|
| Rendimiento | Agregaciones de reportes en la base de datos con índices compuestos; entradas de fecha con *debounce*. |
| Seguridad | Contraseñas y PIN con bcrypt; JWT firmado (`jose`/`jsonwebtoken`); autorización por rol en cada ruta API; límite de intentos de login; secretos solo en `.env` (ver `SECURITY_CHECKLIST.md`). |
| Integridad | Montos en `Decimal(18,2)` y costos en `Decimal(18,4–6)`; snapshots inmutables en factura e historial de ventas; anulaciones en lugar de borrados. |
| Trazabilidad | Empleado registrado en caja, pedido, kardex y auditoría de entradas. |
| Multi-sucursal | Todos los datos operativos se aíslan por `sucursal_id`. |
| Usabilidad | UI responsiva con TailwindCSS, modo oscuro, textos en español. |
| Calidad | TypeScript estricto, ESLint + Prettier, Conventional Commits; pruebas de humo bajo demanda sobre una BD de prueba separada. |

## 7. Arquitectura técnica

- **Framework:** Next.js 15 (App Router, React 19, Server Components) con rutas API en `src/app/api`.
- **ORM / BD:** Prisma 6 sobre MySQL 8.
- **UI:** TailwindCSS 4, lucide-react, ApexCharts, FullCalendar, flatpickr, sonner.
- **Runtime:** Node.js 20.
- **Despliegue:** `npm run build` + `prisma migrate deploy` + `npm start` detrás de un proxy inverso con HTTPS.

### Modelo de datos (resumen)

| Dominio | Entidades |
|---------|-----------|
| Organización | `sucursales`, `empleados` |
| Catálogo | `item`, `producto`, `modificadorProducto`, `receta`, `recetaItem` |
| Inventario | `inventarioSucursal`, `lote`, `stockLoteSucursal`, `movimientoInventario`, `auditoriaEntrada`, `proveedor` |
| Compras / producción | `ordenCompra`, `ordenCompraItem`, `produccion`, `produccionItem` |
| Operación | `caja`, `movimientoCaja`, `pedido`, `pedidoItem`, `pedidoItemExtra`, `factura` |
| Analítica | `historialVentas` |
| MRP | `mrpCorrida`, `mrpForecastDetalle`, `mrpNecesidadInsumo` |

## 8. Flujos clave

1. **Turno de caja:** login → apertura de caja → pedidos y cobros → movimientos de efectivo → cierre con conteo y declarados → ticket de cierre.
2. **Venta:** pedido → comanda a cocina → entrega → cobro → factura → descuento FEFO de insumos → registro en historial de ventas.
3. **Reposición:** corrida MRP → necesidades netas → orden de compra → recepción como entrada por lote → kardex.
4. **Control de costos:** receta + costo estándar → costo teórico; ventas → costo real; reporte de brecha real vs. teórico.

## 9. Riesgos y supuestos

| Riesgo / supuesto | Mitigación |
|-------------------|------------|
| Dependencia de conexión a internet/red local | Evaluar modo offline en una versión futura. |
| Facturación electrónica obligatoria (SIN) | Mantener el modelo preparado (`cuf`, `url_sin`) y planificar la integración. |
| Datos sensibles en respaldos `.sql` del repositorio | Excluirlos del control de versiones y almacenarlos cifrados fuera del repo. |
| Exactitud del MRP con poco histórico | Mostrar MAPE y permitir elegir el método de pronóstico. |

## 10. Hoja de ruta

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Autenticación, usuarios, inventario con lotes FEFO | Hecho |
| 2 | Productos, caja, pedidos, facturación, historial de ventas | Hecho |
| 3 | MRP, costo teórico/estándar, modificadores con precio | Hecho |
| 4 | Auditoría y anulación de entradas, conciliación de tarjeta/QR, reportes de ventas, kardex con empleado, exportaciones CSV | Hecho |
| 5 | Facturación electrónica SIN, traslados entre sucursales, roles adicionales (cocina), panel multi-sucursal consolidado | Pendiente |

## 11. Preguntas abiertas

- ¿Se requiere una vista de cocina (KDS) separada para los estados `COMANDADO`/`PREPARADO`?
- ¿Qué licencia tendrá el producto (MIT o propietaria)?
- ¿Se soportarán pagos divididos en un mismo pedido?

-- Composite indexes for branch-scoped date-range report queries
CREATE INDEX `historialVentas_sucursal_id_fecha_venta_idx` ON `historialVentas`(`sucursal_id`, `fecha_venta`);

CREATE INDEX `caja_sucursal_id_fecha_apertura_idx` ON `caja`(`sucursal_id`, `fecha_apertura`);

CREATE INDEX `pedido_sucursal_id_estado_creado_en_idx` ON `pedido`(`sucursal_id`, `estado`, `creado_en`);

-- AlterTable
ALTER TABLE `pedidoitem` ADD COLUMN `costo_real` DECIMAL(18, 4) NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `historialVentas` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `fecha_venta` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sucursal_id` BIGINT NOT NULL,
    `producto_id` BIGINT NOT NULL,
    `sku_producto` VARCHAR(50) NULL,
    `producto_nombre` VARCHAR(255) NOT NULL,
    `categoria` VARCHAR(100) NULL,
    `cantidad` INTEGER NOT NULL,
    `precio_unitario` DECIMAL(18, 2) NOT NULL,
    `venta_total` DECIMAL(18, 2) NOT NULL,
    `costo_unitario` DECIMAL(18, 4) NOT NULL,
    `costo_total` DECIMAL(18, 4) NOT NULL,
    `margen_ganancia` DECIMAL(18, 4) NOT NULL,
    `nombre_cliente` VARCHAR(255) NULL,
    `numero_factura` VARCHAR(50) NULL,
    `metodo_pago` VARCHAR(50) NOT NULL,
    `pedido_id` BIGINT NOT NULL,
    `empleado_id` BIGINT NOT NULL,

    INDEX `historialVentas_fecha_venta_idx`(`fecha_venta`),
    INDEX `historialVentas_sucursal_id_idx`(`sucursal_id`),
    INDEX `historialVentas_sku_producto_idx`(`sku_producto`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

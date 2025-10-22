-- CreateTable
CREATE TABLE `item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('vendible', 'insumo', 'prep') NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `unidad_code` VARCHAR(16) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `item_sku_key`(`sku`),
    INDEX `item_tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receta` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `item_vendible_id` BIGINT NOT NULL,
    `rendimiento` DECIMAL(18, 6) NOT NULL,
    `merma_pct` DECIMAL(5, 2) NULL,

    UNIQUE INDEX `receta_item_vendible_id_key`(`item_vendible_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recetaItem` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `receta_id` BIGINT NOT NULL,
    `item_insumo_id` BIGINT NOT NULL,
    `cantidad` DECIMAL(18, 6) NOT NULL,
    `merma_pct` DECIMAL(5, 2) NULL,

    INDEX `recetaItem_receta_id_idx`(`receta_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventarioSucursal` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `item_id` BIGINT NOT NULL,
    `stock` DECIMAL(18, 3) NOT NULL,
    `costo_promedio` DECIMAL(18, 4) NOT NULL,
    `stock_min` DECIMAL(18, 3) NOT NULL DEFAULT 0,
    `stock_max` DECIMAL(18, 3) NOT NULL DEFAULT 0,

    INDEX `inventarioSucursal_sucursal_id_idx`(`sucursal_id`),
    UNIQUE INDEX `inventarioSucursal_sucursal_id_item_id_key`(`sucursal_id`, `item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lote` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `item_id` BIGINT NOT NULL,
    `codigo_lote` VARCHAR(64) NOT NULL,
    `fecha_caducidad` DATETIME(3) NULL,
    `costo_unit` DECIMAL(18, 4) NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lote_item_id_fecha_caducidad_idx`(`item_id`, `fecha_caducidad`),
    UNIQUE INDEX `lote_item_id_codigo_lote_key`(`item_id`, `codigo_lote`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stockLoteSucursal` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `lote_id` BIGINT NOT NULL,
    `cantidad` DECIMAL(18, 3) NOT NULL,

    UNIQUE INDEX `stockLoteSucursal_sucursal_id_lote_id_key`(`sucursal_id`, `lote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimientoInventario` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `item_id` BIGINT NOT NULL,
    `lote_id` BIGINT NULL,
    `tipo` ENUM('Entrada', 'Salida', 'Ajuste') NOT NULL,
    `motivo` ENUM('Compra', 'Venta', 'Merma', 'Produccion', 'Ajuste', 'Traslado') NOT NULL,
    `cantidad` DECIMAL(18, 3) NOT NULL,
    `costo_unit` DECIMAL(18, 4) NULL,
    `referencia` VARCHAR(64) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `movimientoInventario_sucursal_id_item_id_creado_en_idx`(`sucursal_id`, `item_id`, `creado_en`),
    INDEX `movimientoInventario_lote_id_idx`(`lote_id`),
    INDEX `movimientoInventario_tipo_creado_en_idx`(`tipo`, `creado_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proveedor` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `nit` VARCHAR(50) NULL,
    `contacto` VARCHAR(191) NULL,
    `telefono` VARCHAR(50) NULL,
    `email` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ordenCompra` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `proveedor_id` BIGINT NOT NULL,
    `estado` VARCHAR(20) NOT NULL,
    `total` DECIMAL(18, 2) NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ordenCompra_proveedor_id_idx`(`proveedor_id`),
    INDEX `ordenCompra_creado_en_idx`(`creado_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ordenCompraItem` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `orden_compra_id` BIGINT NOT NULL,
    `item_id` BIGINT NOT NULL,
    `cantidad` DECIMAL(18, 3) NOT NULL,
    `costo_unit` DECIMAL(18, 4) NOT NULL,

    INDEX `ordenCompraItem_orden_compra_id_idx`(`orden_compra_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produccion` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `prep_item_id` BIGINT NOT NULL,
    `cantidad` DECIMAL(18, 3) NOT NULL,
    `lote_generado_id` BIGINT NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produccionItem` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `produccion_id` BIGINT NOT NULL,
    `item_insumo_id` BIGINT NOT NULL,
    `cantidad` DECIMAL(18, 3) NOT NULL,
    `lote_consumido_id` BIGINT NULL,

    INDEX `produccionItem_produccion_id_idx`(`produccion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modificadorProducto` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `item_vendible_id` BIGINT NOT NULL,
    `item_insumo_id` BIGINT NOT NULL,
    `delta_cantidad` DECIMAL(18, 6) NOT NULL,

    INDEX `modificadorProducto_item_vendible_id_idx`(`item_vendible_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `receta` ADD CONSTRAINT `receta_item_vendible_id_fkey` FOREIGN KEY (`item_vendible_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recetaItem` ADD CONSTRAINT `recetaItem_receta_id_fkey` FOREIGN KEY (`receta_id`) REFERENCES `receta`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recetaItem` ADD CONSTRAINT `recetaItem_item_insumo_id_fkey` FOREIGN KEY (`item_insumo_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventarioSucursal` ADD CONSTRAINT `inventarioSucursal_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventarioSucursal` ADD CONSTRAINT `inventarioSucursal_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lote` ADD CONSTRAINT `lote_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stockLoteSucursal` ADD CONSTRAINT `stockLoteSucursal_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stockLoteSucursal` ADD CONSTRAINT `stockLoteSucursal_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `lote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientoInventario` ADD CONSTRAINT `movimientoInventario_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientoInventario` ADD CONSTRAINT `movimientoInventario_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientoInventario` ADD CONSTRAINT `movimientoInventario_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenCompra` ADD CONSTRAINT `ordenCompra_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenCompra` ADD CONSTRAINT `ordenCompra_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenCompraItem` ADD CONSTRAINT `ordenCompraItem_orden_compra_id_fkey` FOREIGN KEY (`orden_compra_id`) REFERENCES `ordenCompra`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenCompraItem` ADD CONSTRAINT `ordenCompraItem_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produccion` ADD CONSTRAINT `produccion_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produccion` ADD CONSTRAINT `produccion_prep_item_id_fkey` FOREIGN KEY (`prep_item_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produccion` ADD CONSTRAINT `produccion_lote_generado_id_fkey` FOREIGN KEY (`lote_generado_id`) REFERENCES `lote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produccionItem` ADD CONSTRAINT `produccionItem_produccion_id_fkey` FOREIGN KEY (`produccion_id`) REFERENCES `produccion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produccionItem` ADD CONSTRAINT `produccionItem_item_insumo_id_fkey` FOREIGN KEY (`item_insumo_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `produccionItem` ADD CONSTRAINT `produccionItem_lote_consumido_id_fkey` FOREIGN KEY (`lote_consumido_id`) REFERENCES `lote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modificadorProducto` ADD CONSTRAINT `modificadorProducto_item_vendible_id_fkey` FOREIGN KEY (`item_vendible_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modificadorProducto` ADD CONSTRAINT `modificadorProducto_item_insumo_id_fkey` FOREIGN KEY (`item_insumo_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

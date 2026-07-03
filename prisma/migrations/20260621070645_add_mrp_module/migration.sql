-- AlterTable
ALTER TABLE `item` ADD COLUMN `lead_time_dias` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `proveedor_id` BIGINT NULL,
    ADD COLUMN `vida_util_dias` INTEGER NULL;

-- AlterTable
ALTER TABLE `ordencompra` ADD COLUMN `mrp_corrida_id` BIGINT NULL;

-- CreateTable
CREATE TABLE `mrpCorrida` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `horizonte_dias` INTEGER NOT NULL,
    `metodo` VARCHAR(30) NOT NULL,
    `parametros` JSON NULL,
    `empleado_id` BIGINT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mrpCorrida_sucursal_id_creado_en_idx`(`sucursal_id`, `creado_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mrpForecastDetalle` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `corrida_id` BIGINT NOT NULL,
    `producto_id` BIGINT NOT NULL,
    `periodo_inicio` DATETIME(3) NOT NULL,
    `periodo_fin` DATETIME(3) NOT NULL,
    `cantidad_pronosticada` DECIMAL(18, 3) NOT NULL,
    `mape_pct` DECIMAL(6, 2) NULL,
    `mps_qty` DECIMAL(18, 3) NOT NULL,

    INDEX `mrpForecastDetalle_corrida_id_idx`(`corrida_id`),
    INDEX `mrpForecastDetalle_producto_id_idx`(`producto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mrpNecesidadInsumo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `corrida_id` BIGINT NOT NULL,
    `item_id` BIGINT NOT NULL,
    `necesidad_bruta` DECIMAL(18, 3) NOT NULL,
    `stock_actual` DECIMAL(18, 3) NOT NULL,
    `entradas_programadas` DECIMAL(18, 3) NOT NULL,
    `stock_seguridad` DECIMAL(18, 3) NOT NULL,
    `necesidad_neta` DECIMAL(18, 3) NOT NULL,
    `fecha_sugerida_emision` DATETIME(3) NOT NULL,
    `nivel_explosion` INTEGER NOT NULL DEFAULT 0,
    `observaciones` VARCHAR(255) NULL,

    INDEX `mrpNecesidadInsumo_corrida_id_idx`(`corrida_id`),
    INDEX `mrpNecesidadInsumo_item_id_idx`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `item_proveedor_id_idx` ON `item`(`proveedor_id`);

-- CreateIndex
CREATE INDEX `ordenCompra_mrp_corrida_id_idx` ON `ordenCompra`(`mrp_corrida_id`);

-- AddForeignKey
ALTER TABLE `item` ADD CONSTRAINT `item_proveedor_id_fkey` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordenCompra` ADD CONSTRAINT `ordenCompra_mrp_corrida_id_fkey` FOREIGN KEY (`mrp_corrida_id`) REFERENCES `mrpCorrida`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mrpCorrida` ADD CONSTRAINT `mrpCorrida_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mrpForecastDetalle` ADD CONSTRAINT `mrpForecastDetalle_corrida_id_fkey` FOREIGN KEY (`corrida_id`) REFERENCES `mrpCorrida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mrpForecastDetalle` ADD CONSTRAINT `mrpForecastDetalle_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mrpNecesidadInsumo` ADD CONSTRAINT `mrpNecesidadInsumo_corrida_id_fkey` FOREIGN KEY (`corrida_id`) REFERENCES `mrpCorrida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mrpNecesidadInsumo` ADD CONSTRAINT `mrpNecesidadInsumo_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

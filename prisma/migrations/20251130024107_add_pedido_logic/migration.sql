-- CreateTable
CREATE TABLE `pedido` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `empleado_id` BIGINT NOT NULL,
    `caja_id` BIGINT NULL,
    `mesa` VARCHAR(20) NULL,
    `cliente_nombre` VARCHAR(191) NULL DEFAULT 'Cliente Final',
    `estado` ENUM('PENDIENTE', 'COMANDADO', 'PREPARADO', 'ENTREGADO', 'PAGADO', 'ANULADO') NOT NULL DEFAULT 'PENDIENTE',
    `total` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `observaciones` TEXT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    INDEX `pedido_sucursal_id_estado_idx`(`sucursal_id`, `estado`),
    INDEX `pedido_caja_id_idx`(`caja_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedidoItem` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `pedido_id` BIGINT NOT NULL,
    `producto_id` BIGINT NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precio_unit` DECIMAL(18, 2) NOT NULL,
    `subtotal` DECIMAL(18, 2) NOT NULL,
    `notas` VARCHAR(255) NULL,

    INDEX `pedidoItem_pedido_id_idx`(`pedido_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pedidoItemExtra` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `pedido_item_id` BIGINT NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precio` DECIMAL(18, 2) NOT NULL,
    `item_inv_id` BIGINT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `pedido_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `pedido_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedido` ADD CONSTRAINT `pedido_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidoItem` ADD CONSTRAINT `pedidoItem_pedido_id_fkey` FOREIGN KEY (`pedido_id`) REFERENCES `pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidoItem` ADD CONSTRAINT `pedidoItem_producto_id_fkey` FOREIGN KEY (`producto_id`) REFERENCES `producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidoItemExtra` ADD CONSTRAINT `pedidoItemExtra_pedido_item_id_fkey` FOREIGN KEY (`pedido_item_id`) REFERENCES `pedidoItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pedidoItemExtra` ADD CONSTRAINT `pedidoItemExtra_item_inv_id_fkey` FOREIGN KEY (`item_inv_id`) REFERENCES `item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

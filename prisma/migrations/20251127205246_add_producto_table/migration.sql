-- CreateTable
CREATE TABLE `producto` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(500) NULL,
    `categoria` VARCHAR(100) NULL,
    `imagenUrl` VARCHAR(500) NULL,
    `precio` DECIMAL(18, 2) NOT NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'activo',
    `item_inventario_id` BIGINT NULL,

    INDEX `producto_categoria_idx`(`categoria`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `producto` ADD CONSTRAINT `producto_item_inventario_id_fkey` FOREIGN KEY (`item_inventario_id`) REFERENCES `item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `factura` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `pedido_id` BIGINT NOT NULL,
    `razon_social` VARCHAR(255) NOT NULL,
    `nit` VARCHAR(50) NOT NULL,
    `fecha_emision` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `importe_total` DECIMAL(18, 2) NOT NULL,
    `cuf` TEXT NULL,
    `url_sin` VARCHAR(500) NULL,
    `detalle_items` JSON NOT NULL,
    `metodo_pago` VARCHAR(50) NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `factura_pedido_id_key`(`pedido_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `factura` ADD CONSTRAINT `factura_pedido_id_fkey` FOREIGN KEY (`pedido_id`) REFERENCES `pedido`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `auditoriaEntrada` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `movimiento_id` BIGINT NOT NULL,
    `lote_id` BIGINT NOT NULL,
    `sucursal_id` BIGINT NOT NULL,
    `empleado_id` BIGINT NOT NULL,
    `campo` VARCHAR(32) NOT NULL,
    `valor_anterior` VARCHAR(255) NULL,
    `valor_nuevo` VARCHAR(255) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditoriaEntrada_movimiento_id_creado_en_idx`(`movimiento_id`, `creado_en`),
    INDEX `auditoriaEntrada_lote_id_idx`(`lote_id`),
    INDEX `auditoriaEntrada_sucursal_id_creado_en_idx`(`sucursal_id`, `creado_en`),
    INDEX `auditoriaEntrada_empleado_id_idx`(`empleado_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auditoriaEntrada` ADD CONSTRAINT `auditoriaEntrada_movimiento_id_fkey` FOREIGN KEY (`movimiento_id`) REFERENCES `movimientoInventario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoriaEntrada` ADD CONSTRAINT `auditoriaEntrada_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `lote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoriaEntrada` ADD CONSTRAINT `auditoriaEntrada_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoriaEntrada` ADD CONSTRAINT `auditoriaEntrada_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

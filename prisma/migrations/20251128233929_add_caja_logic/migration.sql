-- CreateTable
CREATE TABLE `caja` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `empleado_id` BIGINT NOT NULL,
    `fecha_apertura` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_cierre` DATETIME(3) NULL,
    `saldo_inicial` DECIMAL(18, 2) NOT NULL,
    `saldo_final` DECIMAL(18, 2) NULL,
    `total_ventas` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ventas_efectivo` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ventas_tarjeta` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ventas_qr` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ventas_transfer` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ventas_giftcard` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `ventas_otros` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `entradas_efectivo` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `salidas_efectivo` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `diferencia_efectivo` DECIMAL(18, 2) NULL,
    `diferencia_tarjeta` DECIMAL(18, 2) NULL,
    `diferencia_qr` DECIMAL(18, 2) NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'abierta',
    `observaciones` TEXT NULL,

    INDEX `caja_sucursal_id_idx`(`sucursal_id`),
    INDEX `caja_empleado_id_idx`(`empleado_id`),
    INDEX `caja_fecha_apertura_idx`(`fecha_apertura`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimientoCaja` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `caja_id` BIGINT NOT NULL,
    `tipo` VARCHAR(10) NOT NULL,
    `monto` DECIMAL(18, 2) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `movimientoCaja_caja_id_idx`(`caja_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `caja` ADD CONSTRAINT `caja_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `caja` ADD CONSTRAINT `caja_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientoCaja` ADD CONSTRAINT `movimientoCaja_caja_id_fkey` FOREIGN KEY (`caja_id`) REFERENCES `caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

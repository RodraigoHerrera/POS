-- CreateTable
CREATE TABLE `empleados` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `rol` VARCHAR(50) NOT NULL,
    `usuario` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `contrasena` VARCHAR(255) NOT NULL,
    `celular` VARCHAR(20) NULL,
    `creado` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `estado` VARCHAR(191) NOT NULL DEFAULT 'activo',

    UNIQUE INDEX `empleados_usuario_key`(`usuario`),
    UNIQUE INDEX `empleados_correo_key`(`correo`),
    INDEX `empleados_sucursal_id_idx`(`sucursal_id`),
    INDEX `empleados_correo_idx`(`correo`),
    INDEX `empleados_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sucursales` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `contrasena` VARCHAR(255) NOT NULL,
    `direccion` VARCHAR(191) NULL,
    `telefono` VARCHAR(20) NULL,
    `creado` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sucursales_nombre_key`(`nombre`),
    UNIQUE INDEX `sucursales_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `empleados` ADD CONSTRAINT `empleados_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `Sucursal` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `contraseña` VARCHAR(255) NOT NULL,
    `direccion` VARCHAR(191) NULL,
    `telefono` VARCHAR(191) NULL,

    UNIQUE INDEX `Sucursal_nombre_key`(`nombre`),
    UNIQUE INDEX `Sucursal_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Empleado` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sucursal_id` BIGINT NOT NULL,
    `rol` VARCHAR(50) NOT NULL,
    `correo` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `contraseña` VARCHAR(255) NOT NULL,
    `celular` VARCHAR(191) NULL,
    `creado` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Empleado_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Turno` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `id_empleado` BIGINT NOT NULL,
    `fecha` DATE NOT NULL,
    `hora_entrada` TIME NOT NULL,
    `hora_salida` TIME NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Caja` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `id_cajero` BIGINT NOT NULL,
    `creada` DATETIME(3) NOT NULL,
    `fecha_cierre` DATETIME(3) NULL,
    `estado` VARCHAR(20) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cliente` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nit` VARCHAR(191) NOT NULL,
    `razon` VARCHAR(191) NOT NULL,
    `creado` DATETIME(3) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `correo` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Cliente_nit_key`(`nit`),
    UNIQUE INDEX `Cliente_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Factura` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `id_caja` BIGINT NOT NULL,
    `id_cliente` BIGINT NULL,
    `creada` DATETIME(3) NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `metodo_pago` VARCHAR(50) NOT NULL,
    `descuento` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Producto` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `categoria` VARCHAR(191) NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `estado` VARCHAR(50) NOT NULL,
    `imagen` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DetalleFactura` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `id_factura` BIGINT NOT NULL,
    `id_producto` BIGINT NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `precio_unitario` DECIMAL(10, 2) NOT NULL,
    `detalle` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inventario` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `id_sucursal` BIGINT NOT NULL,
    `codigo` VARCHAR(15) NOT NULL,
    `articulo` VARCHAR(191) NOT NULL,
    `entradas` BIGINT NOT NULL,
    `salidas` BIGINT NOT NULL,
    `stock` BIGINT NOT NULL,

    UNIQUE INDEX `Inventario_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Entrada` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(15) NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `cantidad` BIGINT NOT NULL,
    `id_empleado` BIGINT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Salida` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(15) NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `cantidad` BIGINT NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `id_empleado` BIGINT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Empleado` ADD CONSTRAINT `Empleado_sucursal_id_fkey` FOREIGN KEY (`sucursal_id`) REFERENCES `Sucursal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_id_empleado_fkey` FOREIGN KEY (`id_empleado`) REFERENCES `Empleado`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Caja` ADD CONSTRAINT `Caja_id_cajero_fkey` FOREIGN KEY (`id_cajero`) REFERENCES `Empleado`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factura` ADD CONSTRAINT `Factura_id_caja_fkey` FOREIGN KEY (`id_caja`) REFERENCES `Caja`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Factura` ADD CONSTRAINT `Factura_id_cliente_fkey` FOREIGN KEY (`id_cliente`) REFERENCES `Cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetalleFactura` ADD CONSTRAINT `DetalleFactura_id_factura_fkey` FOREIGN KEY (`id_factura`) REFERENCES `Factura`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetalleFactura` ADD CONSTRAINT `DetalleFactura_id_producto_fkey` FOREIGN KEY (`id_producto`) REFERENCES `Producto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inventario` ADD CONSTRAINT `Inventario_id_sucursal_fkey` FOREIGN KEY (`id_sucursal`) REFERENCES `Sucursal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entrada` ADD CONSTRAINT `Entrada_codigo_fkey` FOREIGN KEY (`codigo`) REFERENCES `Inventario`(`codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entrada` ADD CONSTRAINT `Entrada_id_empleado_fkey` FOREIGN KEY (`id_empleado`) REFERENCES `Empleado`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Salida` ADD CONSTRAINT `Salida_codigo_fkey` FOREIGN KEY (`codigo`) REFERENCES `Inventario`(`codigo`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Salida` ADD CONSTRAINT `Salida_id_empleado_fkey` FOREIGN KEY (`id_empleado`) REFERENCES `Empleado`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `historialventas` ADD COLUMN `costo_teorico_total` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `costo_teorico_unitario` DECIMAL(18, 4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `pedidoitem` ADD COLUMN `costo_teorico` DECIMAL(18, 4) NULL DEFAULT 0;

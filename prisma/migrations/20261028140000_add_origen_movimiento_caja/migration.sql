-- AlterTable: temporary DEFAULT so existing rows can be backfilled
ALTER TABLE `movimientocaja` ADD COLUMN `origen` ENUM('VENTA', 'ANULACION', 'MANUAL') NOT NULL DEFAULT 'VENTA';

-- Backfill: voided-sale refunds
UPDATE `movimientocaja` SET `origen` = 'ANULACION' WHERE `descripcion` LIKE 'Devolución Anulación%';

-- Drop the temporary default (column stays NOT NULL)
ALTER TABLE `movimientocaja` ALTER COLUMN `origen` DROP DEFAULT;

-- CreateIndex
CREATE INDEX `movimientoCaja_caja_id_origen_idx` ON `movimientoCaja`(`caja_id`, `origen`);

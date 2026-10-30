-- AlterTable
ALTER TABLE `movimientoInventario` ADD COLUMN `empleado_id` BIGINT NULL;

-- CreateIndex
CREATE INDEX `movimientoInventario_empleado_id_idx` ON `movimientoInventario`(`empleado_id`);

-- AddForeignKey
ALTER TABLE `movimientoInventario` ADD CONSTRAINT `movimientoInventario_empleado_id_fkey` FOREIGN KEY (`empleado_id`) REFERENCES `empleados`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

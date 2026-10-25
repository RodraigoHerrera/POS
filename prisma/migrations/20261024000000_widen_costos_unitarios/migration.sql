-- AlterTable
ALTER TABLE `item` MODIFY `costo_estandar` DECIMAL(18, 6) NULL;

-- AlterTable
ALTER TABLE `inventarioSucursal` MODIFY `costo_promedio` DECIMAL(18, 6) NOT NULL;

-- AlterTable
ALTER TABLE `lote` MODIFY `costo_unit` DECIMAL(18, 6) NOT NULL;

-- AlterTable
ALTER TABLE `movimientoInventario` MODIFY `costo_unit` DECIMAL(18, 6) NULL;

-- AlterTable
ALTER TABLE `ordenCompraItem` MODIFY `costo_unit` DECIMAL(18, 6) NOT NULL;

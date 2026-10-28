-- AlterTable
ALTER TABLE `item` MODIFY `tipo` ENUM('vendible', 'insumo', 'prep', 'oficina') NOT NULL;

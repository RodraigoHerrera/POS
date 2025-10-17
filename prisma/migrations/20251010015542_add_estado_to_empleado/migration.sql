/*
  Warnings:

  - Added the required column `estado` to the `empleado` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `empleado` ADD COLUMN `estado` VARCHAR(191) NOT NULL;

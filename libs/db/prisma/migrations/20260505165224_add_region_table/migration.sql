/*
  Warnings:

  - You are about to drop the column `region` on the `nodes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `nodes` DROP COLUMN `region`,
    ADD COLUMN `region_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `regions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `regions_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `nodes` ADD CONSTRAINT `nodes_region_id_fkey` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `isReadBy` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `userIds` on the `notifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `notifications` DROP COLUMN `isReadBy`,
    DROP COLUMN `userIds`,
    ADD COLUMN `targetType` VARCHAR(191) NOT NULL DEFAULT 'ALL';

-- CreateTable
CREATE TABLE `notification_recipients` (
    `id` VARCHAR(191) NOT NULL,
    `notificationId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `notification_recipients_userId_idx`(`userId`),
    INDEX `notification_recipients_notificationId_idx`(`notificationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_status` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `notificationId` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,

    INDEX `notification_status_userId_idx`(`userId`),
    UNIQUE INDEX `notification_status_userId_notificationId_key`(`userId`, `notificationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_status` ADD CONSTRAINT `notification_status_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

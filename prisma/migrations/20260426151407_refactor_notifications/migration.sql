/*
  Warnings:

  - You are about to drop the column `isRead` on the `notifications` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `notifications` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `notifications` DROP FOREIGN KEY `notifications_userId_fkey`;

-- DropIndex
DROP INDEX `notifications_userId_isRead_idx` ON `notifications`;

-- AlterTable
ALTER TABLE `notifications` DROP COLUMN `isRead`,
    DROP COLUMN `userId`,
    ADD COLUMN `isReadBy` JSON NOT NULL,
    ADD COLUMN `userIds` JSON NOT NULL;

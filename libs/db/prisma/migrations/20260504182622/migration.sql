/*
  Warnings:

  - You are about to alter the column `status` on the `event_outbox` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `Enum(EnumId(8))`.
  - You are about to alter the column `status` on the `ip_pools` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(3))` to `Enum(EnumId(2))`.
  - You are about to alter the column `status` on the `nodes` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(5))` to `Enum(EnumId(1))`.
  - You are about to alter the column `status` on the `ports` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(4))` to `Enum(EnumId(3))`.
  - You are about to alter the column `status` on the `proxies` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(7))` to `Enum(EnumId(5))`.

*/
-- AlterTable
ALTER TABLE `event_outbox` MODIFY `status` ENUM('PENDING', 'SENT', 'FAILED', 'DEAD') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `ip_pools` MODIFY `status` ENUM('FREE', 'IN_USE', 'COOLING', 'BANNED') NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE `nodes` ADD COLUMN `host` VARCHAR(255) NULL,
    ADD COLUMN `is_3proxy_installed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `last_checked` DATETIME(3) NULL,
    ADD COLUMN `proxy_port_end` INTEGER NOT NULL DEFAULT 20000,
    ADD COLUMN `proxy_port_start` INTEGER NOT NULL DEFAULT 10000,
    ADD COLUMN `ssh_key_passphrase` VARCHAR(255) NULL,
    ADD COLUMN `ssh_password` VARCHAR(255) NULL,
    ADD COLUMN `ssh_port` INTEGER NOT NULL DEFAULT 22,
    ADD COLUMN `ssh_private_key` TEXT NULL,
    ADD COLUMN `ssh_username` VARCHAR(191) NULL,
    MODIFY `status` ENUM('PENDING', 'INSTALLING', 'ACTIVE', 'ERROR', 'OFFLINE', 'SUSPENDED') NOT NULL DEFAULT 'OFFLINE';

-- AlterTable
ALTER TABLE `ports` MODIFY `status` ENUM('FREE', 'USED') NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE `proxies` MODIFY `status` ENUM('PENDING', 'ACTIVE', 'ERROR', 'EXPIRED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `data` JSON NULL;

-- AlterTable
ALTER TABLE `proxies` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `last_checked` DATETIME(3) NULL,
    ADD COLUMN `protocol` ENUM('HTTP', 'SOCKS4', 'SOCKS5') NOT NULL DEFAULT 'SOCKS5';

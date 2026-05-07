-- DropForeignKey
ALTER TABLE `proxies` DROP FOREIGN KEY `proxies_ip_pool_id_fkey`;

-- DropForeignKey
ALTER TABLE `proxies` DROP FOREIGN KEY `proxies_port_id_fkey`;

-- DropIndex
DROP INDEX `proxies_ip_pool_id_key` ON `proxies`;

-- DropIndex
DROP INDEX `proxies_port_id_key` ON `proxies`;

-- AddForeignKey
ALTER TABLE `proxies` ADD CONSTRAINT `proxies_ip_pool_id_fkey` FOREIGN KEY (`ip_pool_id`) REFERENCES `ip_pools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

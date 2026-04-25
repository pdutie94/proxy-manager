-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(255) NOT NULL,
    `userId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `host` VARCHAR(255) NOT NULL,
    `sshPort` INTEGER NOT NULL DEFAULT 22,
    `sshUsername` VARCHAR(191) NOT NULL,
    `sshPassword` VARCHAR(255) NULL,
    `sshPrivateKey` TEXT NULL,
    `sshKeyPassphrase` VARCHAR(255) NULL,
    `proxyPortStart` INTEGER NOT NULL DEFAULT 10000,
    `proxyPortEnd` INTEGER NOT NULL DEFAULT 20000,
    `status` ENUM('PENDING', 'INSTALLING', 'ACTIVE', 'ERROR', 'OFFLINE') NOT NULL DEFAULT 'PENDING',
    `is3ProxyInstalled` BOOLEAN NOT NULL DEFAULT false,
    `lastChecked` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `servers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proxies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `serverId` INTEGER NOT NULL,
    `port` INTEGER NOT NULL,
    `username` VARCHAR(191) NULL,
    `password` VARCHAR(255) NULL,
    `protocol` ENUM('HTTP', 'SOCKS4', 'SOCKS5') NOT NULL DEFAULT 'SOCKS5',
    `assignedTo` INTEGER NULL,
    `expiresAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastChecked` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `proxies_assignedTo_idx`(`assignedTo`),
    INDEX `proxies_isActive_idx`(`isActive`),
    INDEX `proxies_serverId_idx`(`serverId`),
    UNIQUE INDEX `proxies_serverId_port_key`(`serverId`, `port`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proxies` ADD CONSTRAINT `proxies_assignedTo_fkey` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proxies` ADD CONSTRAINT `proxies_serverId_fkey` FOREIGN KEY (`serverId`) REFERENCES `servers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

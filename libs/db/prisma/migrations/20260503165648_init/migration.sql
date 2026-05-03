-- CreateTable
CREATE TABLE `nodes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,
    `status` ENUM('active', 'suspended', 'offline') NOT NULL DEFAULT 'offline',
    `max_ports` INTEGER NOT NULL DEFAULT 60000,
    `ipv6_subnet` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ip_pools` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `node_id` INTEGER NOT NULL,
    `ipv6` VARCHAR(64) NOT NULL,
    `status` ENUM('free', 'in_use', 'cooling', 'banned') NOT NULL DEFAULT 'free',
    `cooldown_until` DATETIME(3) NULL,
    `last_used_at` DATETIME(3) NULL,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ip_pools_node_id_status_cooldown_until_idx`(`node_id`, `status`, `cooldown_until`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ports` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `node_id` INTEGER NOT NULL,
    `port` INTEGER NOT NULL,
    `status` ENUM('free', 'used') NOT NULL DEFAULT 'free',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ports_node_id_status_idx`(`node_id`, `status`),
    UNIQUE INDEX `ports_node_id_port_key`(`node_id`, `port`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proxies` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `node_id` INTEGER NOT NULL,
    `ip_pool_id` BIGINT NOT NULL,
    `port_id` BIGINT NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(50) NOT NULL,
    `status` ENUM('pending', 'active', 'error', 'expired', 'suspended') NOT NULL DEFAULT 'pending',
    `last_config_hash` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `expires_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `proxies_ip_pool_id_key`(`ip_pool_id`),
    UNIQUE INDEX `proxies_port_id_key`(`port_id`),
    INDEX `proxies_user_id_idx`(`user_id`),
    INDEX `proxies_status_idx`(`status`),
    INDEX `proxies_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `traffic_stats` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `proxy_id` BIGINT NOT NULL,
    `bytes_in` BIGINT NOT NULL,
    `bytes_out` BIGINT NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `traffic_stats_proxy_id_recorded_at_idx`(`proxy_id`, `recorded_at`),
    UNIQUE INDEX `traffic_stats_proxy_id_recorded_at_key`(`proxy_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `node_heartbeats` (
    `node_id` INTEGER NOT NULL,
    `last_seen` DATETIME(3) NOT NULL,
    `metrics` JSON NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`node_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_outbox` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('pending', 'sent', 'failed', 'dead') NOT NULL DEFAULT 'pending',
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `sent_at` DATETIME(3) NULL,

    INDEX `event_outbox_status_retry_count_idx`(`status`, `retry_count`),
    INDEX `event_outbox_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_keys` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `response` JSON NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `idempotency_keys_key_key`(`key`),
    INDEX `idempotency_keys_key_idx`(`key`),
    INDEX `idempotency_keys_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` BIGINT NOT NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ip_pools` ADD CONSTRAINT `ip_pools_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ports` ADD CONSTRAINT `ports_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proxies` ADD CONSTRAINT `proxies_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proxies` ADD CONSTRAINT `proxies_ip_pool_id_fkey` FOREIGN KEY (`ip_pool_id`) REFERENCES `ip_pools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proxies` ADD CONSTRAINT `proxies_port_id_fkey` FOREIGN KEY (`port_id`) REFERENCES `ports`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `traffic_stats` ADD CONSTRAINT `traffic_stats_proxy_id_fkey` FOREIGN KEY (`proxy_id`) REFERENCES `proxies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `node_heartbeats` ADD CONSTRAINT `node_heartbeats_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

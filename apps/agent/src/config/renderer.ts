import PQueue from 'p-queue';
import pDebounce from 'p-debounce';
import { ProxyEvent, getShardIndex, CONFIG } from '@proxy-manager/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, rename, copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../logger';

const execAsync = promisify(exec);

interface ProxyConfig {
  proxyId: number;
  ipv6: string;
  port: number;
  username: string;
  password: string;
}

class Debouncer {
  private timeout: NodeJS.Timeout | null = null;
  private maxTimeout: NodeJS.Timeout | null = null;
  
  constructor(private fn: () => void, private wait: number, private maxWait: number) {}
  
  trigger() {
    if (this.timeout) clearTimeout(this.timeout);
    
    const callFn = () => {
      this.timeout = null;
      if (this.maxTimeout) {
        clearTimeout(this.maxTimeout);
        this.maxTimeout = null;
      }
      this.fn();
    };

    this.timeout = setTimeout(callFn, this.wait);
    
    if (!this.maxTimeout) {
      this.maxTimeout = setTimeout(callFn, this.maxWait);
    }
  }
}

export class ConfigRenderer {
  private configDir = '/etc/3proxy/conf.d';
  private proxies = new Map<number, ProxyConfig>();
  private taskQueue = new PQueue({ concurrency: 1 });
  private scheduledUpdates = new Map<string, Debouncer>();
  private lastReloadTime = 0;
  private isReloadPending = false;

  constructor() {
    // Ensure config directory exists
    if (!existsSync(this.configDir)) {
      logger.warn(`Config directory ${this.configDir} does not exist`);
    }
  }

  async addProxy(event: ProxyEvent): Promise<void> {
    const config: ProxyConfig = {
      proxyId: Number(event.proxyId),
      ipv6: event.ipv6!,
      port: event.port!,
      username: event.username!,
      password: event.password!,
    };

    this.proxies.set(Number(event.proxyId), config);
    this.scheduleShardUpdate(getShardIndex(config.port));
  }

  async removeProxy(proxyId: number, port: number): Promise<void> {
    this.proxies.delete(proxyId);
    this.scheduleShardUpdate(getShardIndex(port));
  }

  async rebuildShard(shard: string, proxies: any[]): Promise<void> {
    const configFile = `${this.configDir}/${shard}.cfg`;
    const tempFile = `${configFile}.tmp`;
    const backupFile = `${configFile}.bak`;

    // Ensure config directory exists
    try {
      await mkdir(this.configDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore
    }

    // Build config content
    const lines = proxies.map(p => 
      `# ProxyID: ${p.proxyId}\n` +
      `log /var/log/3proxy/bandwidth.log "L${p.proxyId},%I,%O,%t"\n` +
      `socks -p${p.port.port} -e${p.ipPool.ipv6} -i0.0.0.0\n` +
      `users ${p.username}:CL:${p.password}`
    );

    const content = lines.join('\n\n') + '\n';

    try {
      // Ensure log directory exists
      if (process.platform !== 'win32') {
        await execAsync('mkdir -p /var/log/3proxy && touch /var/log/3proxy/bandwidth.log && chmod 666 /var/log/3proxy/bandwidth.log');
      }

      // Write to temp file
      await writeFile(tempFile, content, 'utf8');

      // Validate (optional - best effort)
      try {
        // Skip validation on Windows or if 3proxy not available
        if (process.platform !== 'win32') {
          await execAsync(`3proxy -c ${tempFile}`);
        }
      } catch (err) {
        logger.warn({ err }, 'Config validation warning');
      }

      // Backup current
      if (existsSync(configFile)) {
        await copyFile(configFile, backupFile);
      }

      // Atomic rename
      await rename(tempFile, configFile);

      // Reload 3proxy (Rate limited)
      await this.reload3proxyRateLimited();

      logger.info(`Updated shard ${shard} with ${proxies.length} proxies`);
    } catch (err) {
      logger.error({ err, shard }, 'Failed to update shard');
      
      // Restore backup on failure
      if (existsSync(backupFile)) {
        await copyFile(backupFile, configFile);
        await this.reload3proxyRateLimited();
      }
      throw err;
    }
  }

  private scheduleShardUpdate(shard: string): void {
    if (!this.scheduledUpdates.has(shard)) {
      const debouncer = new Debouncer(() => {
        const configs = this.getShardConfigs(shard);
        void this.taskQueue.add(() => this.rebuildShard(shard, configs));
      }, CONFIG.DEBOUNCE_MS, 5000); // 5s maxWait

      this.scheduledUpdates.set(shard, debouncer);
    }

    this.scheduledUpdates.get(shard)!.trigger();
  }

  private getShardConfigs(shard: string) {
    return Array.from(this.proxies.values())
      .filter(p => getShardIndex(p.port) === shard)
      .map(c => ({
        proxyId: c.proxyId,
        port: { port: c.port },
        ipPool: { ipv6: c.ipv6 },
        username: c.username,
        password: c.password,
      }));
  }

  private async updateShard(port: number): Promise<void> {
    const shard = getShardIndex(port);
    const configs = this.getShardConfigs(shard);

    await this.rebuildShard(shard, configs);
  }

  private async reload3proxyRateLimited(): Promise<void> {
    const now = Date.now();
    const MIN_RELOAD_INTERVAL = 2000;
    const timeSinceLastReload = now - this.lastReloadTime;

    if (timeSinceLastReload < MIN_RELOAD_INTERVAL) {
      if (!this.isReloadPending) {
        this.isReloadPending = true;
        setTimeout(() => {
          this.isReloadPending = false;
          void this.executeReload();
        }, MIN_RELOAD_INTERVAL - timeSinceLastReload);
      }
      return;
    }

    await this.executeReload();
  }

  private async executeReload(): Promise<void> {
    this.lastReloadTime = Date.now();
    try {
      if (process.platform === 'win32') {
        // Windows: Use taskkill to send signal to 3proxy process
        await execAsync('taskkill /F /IM 3proxy.exe', { timeout: 5000 });
      } else {
        // Linux: Use killall to send USR1 signal
        await execAsync('killall -USR1 3proxy');
      }
    } catch (err) {
      // It's okay if 3proxy is not running - this is expected in development
      logger.info('3proxy reload skipped (not running or not installed)');
    }
  }

  getProxyCount(): number {
    return this.proxies.size;
  }

  async removeAllProxies(): Promise<void> {
    this.proxies.clear();
    this.scheduledUpdates.clear();
    
    if (process.platform !== 'win32') {
      try {
        // Ensure config directory exists
        if (existsSync(this.configDir)) {
          await execAsync(`rm -f ${this.configDir}/*.cfg`);
          await this.reload3proxyRateLimited();
        }
        logger.info('All proxy configurations removed (Node Suspended)');
      } catch (err) {
        logger.error({ err }, 'Failed to clear proxy configs');
      }
    }
  }
}

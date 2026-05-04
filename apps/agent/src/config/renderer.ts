import PQueue from 'p-queue';
import pDebounce from 'p-debounce';
import { ProxyEvent, getShardIndex, CONFIG } from '@proxy-manager/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, rename, copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface ProxyConfig {
  proxyId: number;
  ipv6: string;
  port: number;
  username: string;
  password: string;
}

export class ConfigRenderer {
  private configDir = '/etc/3proxy/conf.d';
  private proxies = new Map<number, ProxyConfig>();
  private taskQueue = new PQueue({ concurrency: 1 });
  private scheduledUpdates = new Map<string, (...args: any[]) => Promise<void>>();

  constructor() {
    // Ensure config directory exists
    if (!existsSync(this.configDir)) {
      console.warn(`Config directory ${this.configDir} does not exist`);
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
      `socks -p${p.port.port} -e${p.ipPool.ipv6} -i0.0.0.0\n` +
      `users ${p.username}:CL:${p.password}`
    );

    const content = lines.join('\n\n') + '\n';

    try {
      // Write to temp file
      await writeFile(tempFile, content, 'utf8');

      // Validate (optional - best effort)
      try {
        // Skip validation on Windows or if 3proxy not available
        if (process.platform !== 'win32') {
          await execAsync(`3proxy -c ${tempFile}`);
        }
      } catch (err) {
        console.warn('Config validation warning:', err);
      }

      // Backup current
      if (existsSync(configFile)) {
        await copyFile(configFile, backupFile);
      }

      // Atomic rename
      await rename(tempFile, configFile);

      // Reload 3proxy
      await this.reload3proxy();

      console.log(`Updated shard ${shard} with ${proxies.length} proxies`);
    } catch (err) {
      console.error(`Failed to update shard ${shard}:`, err);
      
      // Restore backup on failure
      if (existsSync(backupFile)) {
        await copyFile(backupFile, configFile);
        await this.reload3proxy();
      }
      throw err;
    }
  }

  private scheduleShardUpdate(shard: string): void {
    if (!this.scheduledUpdates.has(shard)) {
      const debouncedUpdater = pDebounce(async () => {
        const configs = this.getShardConfigs(shard);
        await this.taskQueue.add(() => this.rebuildShard(shard, configs));
      }, CONFIG.DEBOUNCE_MS);

      this.scheduledUpdates.set(shard, debouncedUpdater);
    }

    const updater = this.scheduledUpdates.get(shard)!;
    void updater().catch(err => console.error(`Failed to update shard ${shard}:`, err));
  }

  private getShardConfigs(shard: string) {
    return Array.from(this.proxies.values())
      .filter(p => getShardIndex(p.port) === shard)
      .map(c => ({
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

  private async reload3proxy(): Promise<void> {
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
      console.log('3proxy reload skipped (not running or not installed)');
    }
  }

  getProxyCount(): number {
    return this.proxies.size;
  }
}

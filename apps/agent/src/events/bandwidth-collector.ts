import { AxiosInstance } from 'axios';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { BufferEntry, FileBuffer } from '../buffer/file-buffer';
import { CONFIG } from '@proxy-manager/common';
import { MetricsCollector } from './metrics-collector';
import { logger } from '../logger';

export class BandwidthCollector {
  private buffer: FileBuffer;
  private api: AxiosInstance;
  private metrics?: MetricsCollector;
  private dataDir: string;
  private logDir: string;
  private interval?: NodeJS.Timeout;

  constructor(api: AxiosInstance, metrics?: MetricsCollector, dataDir = './data', logDir = './logs') {
    this.api = api;
    this.metrics = metrics;
    this.dataDir = dataDir;
    this.logDir = logDir;
    this.buffer = new FileBuffer(this.dataDir);
  }

  async start(): Promise<void> {
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }

    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }

    await this.scanLogFile();
    await this.flush();

    this.interval = setInterval(async () => {
      try {
        await this.scanLogFile();
        await this.flush();
      } catch (err) {
        logger.error('BandwidthCollector error:', err);
      }
    }, CONFIG.TRAFFIC_BATCH_SECONDS * 1000);
  }

  async stop(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  async collect(entry: BufferEntry): Promise<void> {
    await this.buffer.append(entry);
  }

  private async flush(): Promise<void> {
    const entries = await this.buffer.readAll();
    if (entries.length === 0) {
      return;
    }

    try {
      await this.api.post('/api/proxies/traffic/batch', { entries });
      await this.buffer.clear();
      logger.info(`Flushed ${entries.length} bandwidth records`);
    } catch (err) {
      logger.warn('Failed to flush bandwidth records, keeping buffer:', err);
    }
  }

  private async scanLogFile(): Promise<void> {
    const logPath = process.env.BANDWIDTH_LOG_PATH
      ? process.env.BANDWIDTH_LOG_PATH
      : join(this.logDir, 'bandwidth.log');

    const logDir = dirname(logPath);
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true });
    }

    if (!existsSync(logPath)) {
      return;
    }

    const raw = await readFile(logPath, 'utf8');
    if (!raw.trim()) {
      return;
    }

    const lines = raw.split(/\r?\n/).filter(Boolean);
    const entries: BufferEntry[] = [];

    for (const line of lines) {
      const [proxyId, bytesIn, bytesOut, recordedAt] = line.split(',').map(part => part.trim());
      if (!proxyId || !bytesIn || !bytesOut || !recordedAt) {
        continue;
      }

      entries.push({
        proxyId: Number(proxyId),
        bytesIn: Number(bytesIn),
        bytesOut: Number(bytesOut),
        recordedAt,
      });
    }

    if (entries.length > 0) {
      for (const entry of entries) {
        await this.buffer.append(entry);
        this.metrics?.addBandwidth(entry.bytesIn + entry.bytesOut);
      }
      await writeFile(logPath, '', 'utf8');
    }
  }
}


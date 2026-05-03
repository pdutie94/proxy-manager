import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

interface BufferEntry {
  proxyId: number;
  bytesIn: number;
  bytesOut: number;
  recordedAt: string;
}

export class FileBuffer {
  private filePath: string;

  constructor(dataDir = './data') {
    this.filePath = join(dataDir, 'bandwidth-buffer.json');
  }

  async append(entry: BufferEntry): Promise<void> {
    const entries = await this.readAll();
    entries.push(entry);
    await writeFile(this.filePath, JSON.stringify(entries, null, 2), 'utf8');
  }

  async readAll(): Promise<BufferEntry[]> {
    if (!existsSync(this.filePath)) {
      return [];
    }
    try {
      const data = await readFile(this.filePath, 'utf8');
      return JSON.parse(data) as BufferEntry[];
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    await writeFile(this.filePath, '[]', 'utf8');
  }

  async flush(sentCount: number): Promise<void> {
    const entries = await this.readAll();
    const remaining = entries.slice(sentCount);
    await writeFile(this.filePath, JSON.stringify(remaining, null, 2), 'utf8');
  }
}

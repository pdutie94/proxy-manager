export interface MetricsSnapshot {
  configUpdates: number;
  configUpdatesPerSecond: number;
  errorCount: number;
  bandwidthBytes: number;
  lastUpdated: string;
}

export class MetricsCollector {
  private configUpdates = 0;
  private errorCount = 0;
  private bandwidthBytes = 0;
  private recentUpdateTimestamps: number[] = [];

  recordConfigUpdate(): void {
    this.configUpdates += 1;
    const now = Date.now();
    this.recentUpdateTimestamps.push(now);
    this.cleanupTimestamps(now);
  }

  recordError(): void {
    this.errorCount += 1;
  }

  addBandwidth(bytes: number): void {
    this.bandwidthBytes += bytes;
  }

  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    this.cleanupTimestamps(now);
    const perSecond = this.recentUpdateTimestamps.length / 60;

    return {
      configUpdates: this.configUpdates,
      configUpdatesPerSecond: Number(perSecond.toFixed(2)),
      errorCount: this.errorCount,
      bandwidthBytes: this.bandwidthBytes,
      lastUpdated: new Date(now).toISOString(),
    };
  }

  private cleanupTimestamps(now: number): void {
    const cutoff = now - 60 * 1000;
    this.recentUpdateTimestamps = this.recentUpdateTimestamps.filter(ts => ts >= cutoff);
  }
}

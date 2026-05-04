import { ProxyEvent, ProxyEventType } from '@proxy-manager/common';

export interface PrioritizedEvent {
  id: string;
  fields: string[];
  priority: number;
  event: ProxyEvent;
  timestamp: number;
}

export class EventPriorityQueue {
  private queue: PrioritizedEvent[] = [];

  private getPriority(event: ProxyEvent): number {
    switch (event.type) {
      case ProxyEventType.PROXY_DELETE:
        return 100;
      case ProxyEventType.PROXY_EXPIRE:
        return 90;
      case ProxyEventType.PROXY_CREATE:
        return 50;
      case ProxyEventType.PROXY_RENEW:
        return 40;
      default:
        return 0;
    }
  }

  add(id: string, fields: string[], event: ProxyEvent): void {
    const priority = this.getPriority(event);
    const item: PrioritizedEvent = {
      id,
      fields,
      priority,
      event,
      timestamp: Date.now(),
    };

    this.queue.push(item);
    this.sort();
  }

  take(): PrioritizedEvent | null {
    return this.queue.shift() || null;
  }

  size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  private sort(): void {
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }
}

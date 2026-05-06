import { ProxyEvent, ProxyEventType } from '@proxy-manager/common';

export interface PrioritizedEvent {
  id: string;
  fields: string[];
  priority: number;
  event: ProxyEvent;
  timestamp: number;
}

export class EventPriorityQueue {
  private heap: PrioritizedEvent[] = [];

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

  private compare(a: PrioritizedEvent, b: PrioritizedEvent): number {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // higher priority first (negative means a before b)
    }
    return a.timestamp - b.timestamp; // earlier timestamp first (negative means a before b)
  }

  add(id: string, fields: string[], event: ProxyEvent): void {
    const item: PrioritizedEvent = {
      id,
      fields,
      priority: this.getPriority(event),
      event,
      timestamp: Date.now(),
    };
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  take(): PrioritizedEvent | null {
    if (this.heap.length === 0) return null;
    const max = this.heap[0];
    const end = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = end;
      this.sinkDown(0);
    }
    return max;
  }

  size(): number {
    return this.heap.length;
  }

  clear(): void {
    this.heap = [];
  }

  private bubbleUp(index: number): void {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      // If parent should come before element, we're done
      if (this.compare(parent, element) <= 0) break;
      this.heap[parentIndex] = element;
      this.heap[index] = parent;
      index = parentIndex;
    }
  }

  private sinkDown(index: number): void {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      const leftChildIdx = 2 * index + 1;
      const rightChildIdx = 2 * index + 2;
      let swapIdx: number | null = null;

      if (leftChildIdx < length) {
        const leftChild = this.heap[leftChildIdx];
        if (this.compare(element, leftChild) > 0) {
          swapIdx = leftChildIdx;
        }
      }

      if (rightChildIdx < length) {
        const rightChild = this.heap[rightChildIdx];
        if (
          (swapIdx === null && this.compare(element, rightChild) > 0) ||
          (swapIdx !== null && this.compare(this.heap[leftChildIdx], rightChild) > 0)
        ) {
          swapIdx = rightChildIdx;
        }
      }

      if (swapIdx === null) break;
      this.heap[index] = this.heap[swapIdx];
      this.heap[swapIdx] = element;
      index = swapIdx;
    }
  }
}

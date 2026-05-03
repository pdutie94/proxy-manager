export interface IRedisService {
  xadd(key: string, id: string, ...args: string[]): Promise<string>;
  xreadgroup(group: string, consumer: string, ...args: any[]): Promise<any>;
  xack(key: string, group: string, ...ids: string[]): Promise<number>;
  xgroup(...args: any[]): Promise<string>;
  xpending(key: string, group: string): Promise<any>;
  xclaim(...args: any[]): Promise<any>;
  disconnect(): Promise<void>;
  ping(): Promise<string>;
}

// Production: Real Redis
export class RedisService implements IRedisService {
  constructor(private redis: any) {}

  async xadd(key: string, id: string, ...args: string[]): Promise<string> {
    return this.redis.xadd(key, id, ...args);
  }

  async xreadgroup(group: string, consumer: string, ...args: any[]): Promise<any> {
    return this.redis.xreadgroup(group, consumer, ...args);
  }

  async xack(key: string, group: string, ...ids: string[]): Promise<number> {
    return this.redis.xack(key, group, ...ids);
  }

  async xgroup(...args: any[]): Promise<string> {
    return this.redis.xgroup(...args);
  }

  async xpending(key: string, group: string): Promise<any> {
    return this.redis.xpending(key, group);
  }

  async xclaim(...args: any[]): Promise<any> {
    return this.redis.xclaim(...args);
  }

  async disconnect(): Promise<void> {
    return this.redis.disconnect();
  }

  async ping(): Promise<string> {
    return this.redis.ping();
  }
}

// Development: Mock Redis
export class MockRedisService implements IRedisService {
  private data = new Map<string, any>();
  
  async xadd(key: string, id: string, ...args: string[]): Promise<string> {
    console.log(`🔴 Mock Redis XADD: ${key}`, { id, args });
    return `mock-${Date.now()}`;
  }
  
  async xreadgroup(group: string, consumer: string, ...args: any[]): Promise<any> {
    console.log(`🔴 Mock Redis XREADGROUP: ${group}/${consumer}`);
    return [];
  }
  
  async xack(key: string, group: string, ...ids: string[]): Promise<number> {
    console.log(`🔴 Mock Redis XACK: ${key}/${group}`, ids);
    return 1;
  }
  
  async xgroup(...args: any[]): Promise<string> {
    console.log(`🔴 Mock Redis XGROUP`, args);
    return 'OK';
  }
  
  async xpending(key: string, group: string): Promise<any> {
    return [];
  }
  
  async xclaim(...args: any[]): Promise<any> {
    return [];
  }
  
  async disconnect(): Promise<void> {
    console.log('🔴 Mock Redis disconnect');
  }
  
  async ping(): Promise<string> {
    return 'PONG';
  }
}

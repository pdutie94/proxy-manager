// Mock Redis for Node Agent testing
export class MockRedis {
  private streams = new Map<string, any[]>();
  private data = new Map<string, any>();

  async xadd(key: string, id: string, ...args: string[]): Promise<string> {
    console.log(`🔴 Mock Redis XADD: ${key}`, { id, args });
    
    if (!this.streams.has(key)) {
      this.streams.set(key, []);
    }
    
    const stream = this.streams.get(key)!;
    const entry = {
      id: id === '*' ? `mock-${Date.now()}` : id,
      data: args,
    };
    
    stream.push(entry);
    return entry.id;
  }
  
  async xreadgroup(group: string, consumer: string, ...args: any[]): Promise<any> {
    console.log(`🔴 Mock Redis XREADGROUP: ${group}/${consumer}`, args);
    
    // Simulate empty response for now
    return [];
  }
  
  async xack(key: string, group: string, ...ids: string[]): Promise<number> {
    console.log(`🔴 Mock Redis XACK: ${key}/${group}`, ids);
    return ids.length;
  }
  
  async xgroup(...args: any[]): Promise<string> {
    console.log(`🔴 Mock Redis XGROUP`, args);
    return 'OK';
  }
  
  async xpending(key: string, group: string): Promise<any> {
    console.log(`🔴 Mock Redis XPENDING: ${key}/${group}`);
    return [];
  }
  
  async xclaim(...args: any[]): Promise<any> {
    console.log(`🔴 Mock Redis XCLAIM`, args);
    return [];
  }
  
  async disconnect(): Promise<void> {
    console.log('🔴 Mock Redis disconnect');
  }
  
  async ping(): Promise<string> {
    return 'PONG';
  }

  // Helper method to simulate events for testing
  simulateEvent(key: string, event: any) {
    if (!this.streams.has(key)) {
      this.streams.set(key, []);
    }
    
    const stream = this.streams.get(key)!;
    const eventData = JSON.stringify(event);
    
    stream.push({
      id: `mock-${Date.now()}`,
      data: ['data', eventData],
    });
    
    console.log(`🔴 Mock Redis: Simulated event added to ${key}`, event);
  }
}

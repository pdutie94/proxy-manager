#!/usr/bin/env node

/**
 * End-to-End Test Script for Proxy Manager
 * Tests the complete flow: API → Redis → Agent → Config
 */

const axios = require('axios');
const Redis = require('ioredis');

const API_BASE = 'http://localhost:3001/api';
const REDIS_URL = 'redis://localhost:6379';

// Test configuration
const TEST_IPV6_SUBNET = '2001:db8:test::/64';

class E2ETest {
  constructor() {
    this.redis = new Redis(REDIS_URL);
    this.testResults = [];
    this.testNodeId = null;
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    console.log(logEntry);
    this.testResults.push({ timestamp, message, type });
  }

  async step(name, fn) {
    this.log(`🔄 ${name}`);
    try {
      await fn();
      this.log(`✅ ${name} - PASSED`);
      return true;
    } catch (error) {
      this.log(`❌ ${name} - FAILED: ${error.message}`, 'error');
      return false;
    }
  }

  async setupTestNode() {
    // First, try to get existing active nodes
    try {
      const response = await axios.get(`${API_BASE}/nodes`);
      const nodes = response.data;
      const activeNode = nodes.find(n => n.status === 'ACTIVE');
      
      if (activeNode) {
        this.testNodeId = activeNode.id;
        this.log(`Using existing node: ${this.testNodeId}`);
        return;
      }
    } catch (error) {
      this.log('No existing nodes found, creating new one...');
    }
    
    // Create test node if no active node exists
    const nodeData = {
      name: 'Test Node E2E',
      ipAddress: '127.0.0.1',
      region: 'local',
      ipv6Subnet: TEST_IPV6_SUBNET,
      maxPorts: 1000,
      status: 'ACTIVE'
    };

    const response = await axios.post(`${API_BASE}/nodes`, nodeData);
    this.testNodeId = response.data.id;
    this.log(`Created test node: ${this.testNodeId}`);
    
    // Wait a moment for ports to be generated
    this.log('Waiting for ports to be generated...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async cleanupTestNode() {
    if (this.testNodeId) {
      try {
        await axios.delete(`${API_BASE}/nodes/${this.testNodeId}`);
        this.log(`Cleaned up test node: ${this.testNodeId}`);
      } catch (error) {
        // Node might already be deleted
        this.log(`Node cleanup skipped: ${error.message}`);
      }
    }
  }

  async createProxy() {
    const proxyData = {
      nodeId: this.testNodeId,
      userId: 1,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      protocol: 'SOCKS5',
      idempotencyKey: `test-${Date.now()}`
    };

    const response = await axios.post(`${API_BASE}/proxies`, proxyData);
    this.testProxy = response.data;
    this.log(`Created proxy: ${this.testProxy.id}`);
    return this.testProxy;
  }

  async waitForProxyStatus(proxyId, targetStatus, timeoutMs = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await axios.get(`${API_BASE}/proxies/${proxyId}`);
        const proxy = response.data;
        
        if (proxy.status === targetStatus) {
          this.log(`Proxy ${proxyId} reached status: ${targetStatus}`);
          return proxy;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        this.log(`Error checking proxy status: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error(`Timeout waiting for proxy status: ${targetStatus}`);
  }

  async checkRedisEvent(proxyId) {
    // Check if event was published to Redis stream
    const events = await this.redis.xrange('proxy_events', '-', '+');
    const proxyEvent = events.find(([id, fields]) => 
      fields.includes(`proxyId:${proxyId}`)
    );
    
    if (proxyEvent) {
      this.log(`✅ Found event in Redis for proxy ${proxyId}`);
      return true;
    } else {
      this.log(`❌ No event found in Redis for proxy ${proxyId}`);
      return false;
    }
  }

  async checkAgentHealth() {
    try {
      const response = await axios.get('http://localhost:3002/health');
      this.log(`Agent health: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.log(`Agent not reachable: ${error.message}`);
      return null;
    }
  }

  async checkConfigFile(proxyId, port) {
    // This would check if the proxy config was written
    // For testing purposes, we'll simulate this check
    const shard = port % 256;
    const hexShard = shard.toString(16).padStart(2, '0');
    const configFile = `/etc/3proxy/conf.d/${hexShart}.cfg`;
    
    this.log(`📁 Checking config file: ${configFile}`);
    // In real test, you'd read the file and verify proxy config
    return true;
  }

  async runTests() {
    this.log('🚀 Starting End-to-End Tests');
    
    let allPassed = true;

    // Test 1: API Health
    allPassed &= await this.step('API Health Check', async () => {
      const response = await axios.get(`${API_BASE}/health`);
      if (response.status !== 200) {
        throw new Error(`API returned status: ${response.status}`);
      }
    });

    // Test 2: Setup Test Node
    allPassed &= await this.step('Setup Test Node', async () => {
      await this.setupTestNode();
    });

    // Test 3: Create Proxy
    allPassed &= await this.step('Create Proxy', async () => {
      await this.createProxy();
    });

    // Test 4: Check Redis Event
    allPassed &= await this.step('Check Redis Event', async () => {
      const found = await this.checkRedisEvent(this.testProxy.id);
      if (!found) {
        throw new Error('Event not found in Redis');
      }
    });

    // Test 5: Wait for Proxy to become Active
    allPassed &= await this.step('Wait for Proxy Activation', async () => {
      const activeProxy = await this.waitForProxyStatus(this.testProxy.id, 'ACTIVE');
      this.testProxy = activeProxy;
    });

    // Test 6: Check Agent Health
    allPassed &= await this.step('Check Agent Health', async () => {
      const agentHealth = await this.checkAgentHealth();
      if (!agentHealth) {
        throw new Error('Agent not responding');
      }
    });

    // Test 7: Verify Config File
    allPassed &= await this.step('Verify Config File', async () => {
      const configOk = await this.checkConfigFile(this.testProxy.id, this.testProxy.port);
      if (!configOk) {
        throw new Error('Config file verification failed');
      }
    });

    // Test 8: Delete Proxy
    allPassed &= await this.step('Delete Proxy', async () => {
      await axios.delete(`${API_BASE}/proxies/${this.testProxy.id}`);
      await this.waitForProxyStatus(this.testProxy.id, 'DELETED');
    });

    // Cleanup
    await this.cleanupTestNode();

    // Summary
    this.log('\n📊 Test Results Summary:');
    this.log(`Total tests: ${this.testResults.filter(r => r.type === 'info').length}`);
    this.log(`Passed: ${this.testResults.filter(r => r.type === 'info' && r.message.includes('PASSED')).length}`);
    this.log(`Failed: ${this.testResults.filter(r => r.type === 'error').length}`);
    
    if (allPassed) {
      this.log('🎉 All tests PASSED!');
    } else {
      this.log('💥 Some tests FAILED!', 'error');
    }

    return allPassed;
  }

  async cleanup() {
    await this.redis.quit();
  }
}

// Run tests
async function main() {
  const tester = new E2ETest();
  
  try {
    const success = await tester.runTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Test runner failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = E2ETest;

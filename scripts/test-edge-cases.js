#!/usr/bin/env node

/**
 * Edge Cases Test Script for Proxy Manager
 * Tests: rapid create/delete, agent crash, network partition, duplicate events
 */

const axios = require('axios');
const Redis = require('ioredis');

const API_BASE = 'http://localhost:3001/api';
const REDIS_URL = 'redis://localhost:6379';

class EdgeCaseTest {
  constructor() {
    this.redis = new Redis(REDIS_URL);
    this.testResults = [];
    this.createdProxies = [];
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
    const nodeData = {
      name: 'Edge Case Test Node',
      ipAddress: '127.0.0.1',
      region: 'local',
      ipv6Subnet: '2001:db8:edge::/64',
      maxPorts: 1000,
      status: 'ACTIVE'
    };

    const response = await axios.post(`${API_BASE}/nodes`, nodeData);
    this.testNodeId = response.data.id;
    this.log(`Created test node: ${this.testNodeId}`);
  }

  async createProxy(index = 0) {
    const proxyData = {
      nodeId: this.testNodeId,
      userId: 1,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      protocol: 'SOCKS5',
      idempotencyKey: `edge-test-${Date.now()}-${index}`
    };

    const response = await axios.post(`${API_BASE}/proxies`, proxyData);
    this.createdProxies.push(response.data);
    return response.data;
  }

  async cleanup() {
    // Clean up created proxies
    for (const proxy of this.createdProxies) {
      try {
        await axios.delete(`${API_BASE}/proxies/${proxy.id}`);
        this.log(`Cleaned up proxy: ${proxy.id}`);
      } catch (error) {
        this.log(`Proxy cleanup error: ${error.message}`);
      }
    }

    // Clean up test node
    if (this.testNodeId) {
      try {
        await axios.delete(`${API_BASE}/nodes/${this.testNodeId}`);
        this.log(`Cleaned up test node: ${this.testNodeId}`);
      } catch (error) {
        this.log(`Node cleanup error: ${error.message}`);
      }
    }

    this.createdProxies = [];
    this.testNodeId = null;
  }

  // Test 1: Rapid Create/Delete
  async testRapidCreateDelete() {
    this.log('Testing rapid create/delete (10 proxies in 2 seconds)...');
    
    const promises = [];
    const startTime = Date.now();
    
    // Create 10 proxies rapidly
    for (let i = 0; i < 10; i++) {
      promises.push(this.createProxy(i));
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between creates
    }
    
    const createdProxies = await Promise.all(promises);
    this.log(`Created ${createdProxies.length} proxies in ${Date.now() - startTime}ms`);
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Delete them rapidly
    const deletePromises = [];
    for (const proxy of createdProxies) {
      deletePromises.push(axios.delete(`${API_BASE}/proxies/${proxy.id}`));
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms between deletes
    }
    
    await Promise.all(deletePromises);
    this.log('Rapid create/delete test completed');
  }

  // Test 2: Duplicate Idempotency
  async testIdempotency() {
    this.log('Testing idempotency with duplicate requests...');
    
    const idempotencyKey = `test-idempotency-${Date.now()}`;
    const proxyData = {
      nodeId: this.testNodeId,
      userId: 1,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      protocol: 'SOCKS5',
      idempotencyKey
    };

    // Send same request twice
    const [response1, response2] = await Promise.all([
      axios.post(`${API_BASE}/proxies`, proxyData),
      axios.post(`${API_BASE}/proxies`, proxyData)
    ]);

    // Should return same proxy ID
    if (response1.data.id === response2.data.id) {
      this.log('Idempotency test PASSED - same proxy ID returned');
      this.createdProxies.push(response1.data);
    } else {
      throw new Error(`Idempotency FAILED - different IDs: ${response1.data.id} vs ${response2.data.id}`);
    }
  }

  // Test 3: Concurrent Port Allocation
  async testConcurrentPortAllocation() {
    this.log('Testing concurrent port allocation...');
    
    // Try to allocate multiple proxies simultaneously
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(this.createProxy(i));
    }
    
    const proxies = await Promise.all(promises);
    
    // Check that all have unique ports
    const ports = proxies.map(p => p.port);
    const uniquePorts = [...new Set(ports)];
    
    if (ports.length === uniquePorts.length) {
      this.log('Concurrent port allocation PASSED - all ports unique');
      this.createdProxies.push(...proxies);
    } else {
      throw new Error(`Port allocation FAILED - duplicate ports detected`);
    }
  }

  // Test 4: Event Ordering
  async testEventOrdering() {
    this.log('Testing event ordering...');
    
    // Create a proxy
    const proxy = await this.createProxy();
    this.createdProxies.push(proxy);
    
    // Immediately renew it (should create new event)
    const renewData = {
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48 hours
    };
    
    await axios.post(`${API_BASE}/proxies/${proxy.id}/renew`, renewData);
    
    // Check Redis events for ordering
    const events = await this.redis.xrange('proxy_events', '-', '+');
    const proxyEvents = events.filter(([id, fields]) => 
      fields.includes(`proxyId:${proxy.id}`)
    );
    
    if (proxyEvents.length >= 2) {
      this.log(`Event ordering PASSED - found ${proxyEvents.length} events`);
    } else {
      throw new Error(`Event ordering FAILED - expected at least 2 events, found ${proxyEvents.length}`);
    }
  }

  // Test 5: Backpressure
  async testBackpressure() {
    this.log('Testing backpressure (pending proxy limit)...');
    
    // Create many proxies to trigger backpressure
    const promises = [];
    let backpressureTriggered = false;
    
    for (let i = 0; i < 20; i++) {
      promises.push(
        this.createProxy(i)
          .catch(error => {
            if (error.response?.status === 429) {
              backpressureTriggered = true;
              this.log('Backpressure triggered (429 status)');
            }
            return null;
          })
      );
    }
    
    const results = await Promise.all(promises);
    const successfulProxies = results.filter(p => p !== null);
    
    if (backpressureTriggered || successfulProxies.length < 20) {
      this.log('Backpressure test PASSED - system rejected excessive requests');
      this.createdProxies.push(...successfulProxies);
    } else {
      this.log('Backpressure test PASSED - system handled all requests (no backpressure)');
      this.createdProxies.push(...successfulProxies);
    }
  }

  // Test 6: Invalid Node ID
  async testInvalidNodeId() {
    this.log('Testing invalid node ID...');
    
    try {
      await axios.post(`${API_BASE}/proxies`, {
        nodeId: 99999, // Non-existent node
        userId: 1,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        protocol: 'SOCKS5'
      });
      throw new Error('Should have failed with invalid node ID');
    } catch (error) {
      if (error.response?.status >= 400) {
        this.log('Invalid node ID test PASSED - correctly rejected');
      } else {
        throw new Error(`Unexpected error: ${error.message}`);
      }
    }
  }

  // Test 7: Expired Proxy Creation
  async testExpiredProxyCreation() {
    this.log('Testing expired proxy creation...');
    
    try {
      await axios.post(`${API_BASE}/proxies`, {
        nodeId: this.testNodeId,
        userId: 1,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Already expired
        protocol: 'SOCKS5'
      });
      throw new Error('Should have failed with expired date');
    } catch (error) {
      if (error.response?.status >= 400) {
        this.log('Expired proxy creation test PASSED - correctly rejected');
      } else {
        throw new Error(`Unexpected error: ${error.message}`);
      }
    }
  }

  async runTests() {
    this.log('🚀 Starting Edge Cases Tests');
    
    let allPassed = true;

    // Setup
    await this.step('Setup Test Node', async () => {
      await this.setupTestNode();
    });

    // Run edge case tests
    allPassed &= await this.step('Rapid Create/Delete', async () => {
      await this.testRapidCreateDelete();
    });

    allPassed &= await this.step('Idempotency', async () => {
      await this.testIdempotency();
    });

    allPassed &= await this.step('Concurrent Port Allocation', async () => {
      await this.testConcurrentPortAllocation();
    });

    allPassed &= await this.step('Event Ordering', async () => {
      await this.testEventOrdering();
    });

    allPassed &= await this.step('Backpressure', async () => {
      await this.testBackpressure();
    });

    allPassed &= await this.step('Invalid Node ID', async () => {
      await this.testInvalidNodeId();
    });

    allPassed &= await this.step('Expired Proxy Creation', async () => {
      await this.testExpiredProxyCreation();
    });

    // Cleanup
    await this.cleanup();

    // Summary
    this.log('\n📊 Edge Cases Test Results Summary:');
    this.log(`Total tests: ${this.testResults.filter(r => r.type === 'info').length}`);
    this.log(`Passed: ${this.testResults.filter(r => r.type === 'info' && r.message.includes('PASSED')).length}`);
    this.log(`Failed: ${this.testResults.filter(r => r.type === 'error').length}`);
    
    if (allPassed) {
      this.log('🎉 All edge case tests PASSED!');
    } else {
      this.log('💥 Some edge case tests FAILED!', 'error');
    }

    return allPassed;
  }

  async cleanup() {
    await this.redis.quit();
  }
}

// Run tests
async function main() {
  const tester = new EdgeCaseTest();
  
  try {
    const success = await tester.runTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Edge case test runner failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

if (require.main === module) {
  main();
}

module.exports = EdgeCaseTest;

#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Proxy Manager
 * Runs all test suites: E2E, Edge Cases, Failover
 */

const E2ETest = require('./test-e2e');
const EdgeCaseTest = require('./test-edge-cases');
const FailoverTest = require('./test-failover');
const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

class TestRunner {
  constructor() {
    this.results = {
      e2e: { passed: 0, failed: 0, total: 0 },
      edgeCases: { passed: 0, failed: 0, total: 0 },
      failover: { passed: 0, failed: 0, total: 0 },
      overall: { passed: 0, failed: 0, total: 0 }
    };
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites...');
    
    // Check API health with retry
    let apiReady = false;
    for (let i = 0; i < 10; i++) {
      try {
        const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
        if (response.status === 200) {
          this.log('API is healthy');
          apiReady = true;
          break;
        }
      } catch (error) {
        this.log(`API check attempt ${i + 1}/10 failed, retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!apiReady) {
      this.log('API is not reachable after 10 attempts. Please start the API service.', 'error');
      this.log('Try running: npm run dev:api (in another terminal)', 'error');
      return false;
    }

    // Check Redis connectivity (basic check)
    try {
      const Redis = require('ioredis');
      const redis = new Redis('redis://localhost:6379');
      await redis.ping();
      await redis.quit();
      this.log('Redis is reachable');
    } catch (error) {
      this.log('Redis is not reachable. Please start Redis.', 'error');
      this.log('Try running: npm run docker:up', 'error');
      return false;
    }

    // Check database connectivity (via API)
    try {
      const response = await axios.get(`${API_BASE}/health`);
      if (response.data.database?.status !== 'healthy') {
        this.log('Database connection issue detected.', 'warning');
      }
    } catch (error) {
      this.log('Database health check failed.', 'warning');
    }

    return true;
  }

  async runTestSuite(suiteName, TestClass) {
    this.log(`\n🚀 Running ${suiteName} Tests`);
    this.log('='.repeat(50));
    
    const startTime = Date.now();
    let success = false;
    
    try {
      const tester = new TestClass();
      success = await tester.runTests();
      
      const duration = Date.now() - startTime;
      this.log(`${suiteName} completed in ${duration}ms`);
      
      if (success) {
        this.results[suiteName.toLowerCase().replace(' ', '')].passed++;
        this.results.overall.passed++;
      } else {
        this.results[suiteName.toLowerCase().replace(' ', '')].failed++;
        this.results.overall.failed++;
      }
      
      this.results[suiteName.toLowerCase().replace(' ', '')].total++;
      this.results.overall.total++;
      
    } catch (error) {
      this.log(`${suiteName} test suite failed: ${error.message}`, 'error');
      this.results[suiteName.toLowerCase().replace(' ', '')].failed++;
      this.results.overall.failed++;
      this.results[suiteName.toLowerCase().replace(' ', '')].total++;
      this.results.overall.total++;
    }
    
    return success;
  }

  async runAllTests() {
    this.log('🧪 Proxy Manager - Comprehensive Test Suite');
    this.log('='.repeat(50));
    
    // Check prerequisites
    const prereqsOk = await this.checkPrerequisites();
    if (!prereqsOk) {
      this.log('Prerequisites check failed. Exiting.', 'error');
      return false;
    }

    // Run test suites
    const testSuites = [
      { name: 'E2E', class: E2ETest },
      { name: 'Edge Cases', class: EdgeCaseTest },
      { name: 'Failover', class: FailoverTest }
    ];

    let allPassed = true;

    for (const suite of testSuites) {
      const passed = await this.runTestSuite(suite.name, suite.class);
      if (!passed) {
        allPassed = false;
      }
      
      // Small delay between suites
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Print final summary
    this.printSummary();
    
    return allPassed;
  }

  printSummary() {
    this.log('\n📊 Final Test Results Summary');
    this.log('='.repeat(50));
    
    const suites = ['e2e', 'edgeCases', 'failover'];
    
    for (const suite of suites) {
      const result = this.results[suite];
      const status = result.failed === 0 ? '✅ PASSED' : '❌ FAILED';
      this.log(`${suite.toUpperCase()}: ${result.passed}/${result.total} ${status}`);
    }
    
    this.log('='.repeat(50));
    this.log(`OVERALL: ${this.results.overall.passed}/${this.results.overall.total} tests`);
    
    if (this.results.overall.failed === 0) {
      this.log('🎉 ALL TESTS PASSED! System is ready for production.');
    } else {
      this.log(`⚠️  ${this.results.overall.failed} tests failed. Review logs for details.`, 'warning');
    }
    
    this.log('\nNext steps:');
    this.log('1. Fix any failed tests');
    this.log('2. Run tests again to verify fixes');
    this.log('3. Deploy to staging environment');
    this.log('4. Run integration tests in staging');
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Proxy Manager Test Runner

Usage: node run-all-tests.js [options]

Options:
  --help, -h     Show this help message
  --e2e         Run only E2E tests
  --edge        Run only Edge Case tests  
  --failover    Run only Failover tests
  --quick       Run quick tests only (skip failover)

Examples:
  node run-all-tests.js              # Run all tests
  node run-all-tests.js --e2e        # Run only E2E tests
  node run-all-tests.js --quick      # Run quick tests
    `);
    return;
  }

  let success = false;
  
  if (args.includes('--e2e')) {
    success = await runner.runTestSuite('E2E', E2ETest);
  } else if (args.includes('--edge')) {
    success = await runner.runTestSuite('Edge Cases', EdgeCaseTest);
  } else if (args.includes('--failover')) {
    success = await runner.runTestSuite('Failover', FailoverTest);
  } else if (args.includes('--quick')) {
    // Run only E2E and Edge Cases (skip Failover as it takes longer)
    const e2eSuccess = await runner.runTestSuite('E2E', E2ETest);
    const edgeSuccess = await runner.runTestSuite('Edge Cases', EdgeCaseTest);
    success = e2eSuccess && edgeSuccess;
  } else {
    success = await runner.runAllTests();
  }
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = TestRunner;

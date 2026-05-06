#!/usr/bin/env node

/**
 * Services Connectivity Verification Script
 * Verifies all required services are running and accessible
 */

const axios = require('axios');
const Redis = require('ioredis');
const net = require('net');

const SERVICES = {
  mysql: { port: 3306, host: 'localhost' },
  redis: { port: 6379, host: 'localhost' },
  api: { port: 3001, host: 'localhost', url: 'http://localhost:3001/api' },
  dashboard: { port: 3000, host: 'localhost', url: 'http://localhost:3000' },
  agent: { port: 3002, host: 'localhost', url: 'http://localhost:3002' }
};

class ServiceVerifier {
  constructor() {
    this.results = {};
  }

  async log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async checkPort(service, port, host) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(3000);
      
      socket.on('connect', () => {
        socket.end();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  async checkMySQL() {
    this.log('Checking MySQL connectivity...');
    
    try {
      const isConnected = await this.checkPort('mysql', SERVICES.mysql.port, SERVICES.mysql.host);
      
      if (isConnected) {
        this.log('MySQL port is open');
        
        // Additional check via API (if API is running)
        try {
          const response = await axios.get(`${SERVICES.api.url}/health`, { timeout: 5000 });
          // API returns services.database.status (not database.status)
          if (response.data.services?.database?.status === 'connected') {
            this.log('MySQL database connection: HEALTHY');
            this.results.mysql = { status: 'healthy', message: 'Database connected and operational' };
          } else {
            this.log('MySQL database connection: ISSUES', 'warning');
            this.results.mysql = { status: 'warning', message: 'Port open but database issues detected' };
          }
        } catch (error) {
          this.log('MySQL port open but API not available for database check');
          this.results.mysql = { status: 'healthy', message: 'Port accessible (API check pending)' };
        }
      } else {
        this.log('MySQL port is closed', 'error');
        this.results.mysql = { status: 'error', message: 'Port 3306 not accessible' };
      }
    } catch (error) {
      this.log(`MySQL check failed: ${error.message}`, 'error');
      this.results.mysql = { status: 'error', message: error.message };
    }
  }

  async checkRedis() {
    this.log('Checking Redis connectivity...');
    
    try {
      const isConnected = await this.checkPort('redis', SERVICES.redis.port, SERVICES.redis.host);
      
      if (isConnected) {
        this.log('Redis port is open');
        
        // Test Redis connection
        const redis = new Redis('redis://localhost:6379');
        const pong = await redis.ping();
        await redis.quit();
        
        if (pong === 'PONG') {
          this.log('Redis connection: HEALTHY');
          this.results.redis = { status: 'healthy', message: 'Redis responding to PING' };
        } else {
          this.log('Redis connection: UNEXPECTED RESPONSE', 'warning');
          this.results.redis = { status: 'warning', message: `Unexpected response: ${pong}` };
        }
      } else {
        this.log('Redis port is closed', 'error');
        this.results.redis = { status: 'error', message: 'Port 6379 not accessible' };
      }
    } catch (error) {
      this.log(`Redis check failed: ${error.message}`, 'error');
      this.results.redis = { status: 'error', message: error.message };
    }
  }

  async checkAPI() {
    this.log('Checking API service...');
    
    try {
      const isConnected = await this.checkPort('api', SERVICES.api.port, SERVICES.api.host);
      
      if (isConnected) {
        this.log('API port is open');
        
        // Test API health endpoint
        const response = await axios.get(`${SERVICES.api.url}/health`, { timeout: 5000 });
        
        if (response.status === 200) {
          this.log('API health endpoint: HEALTHY');
          this.results.api = { 
            status: 'healthy', 
            message: 'API responding',
            details: response.data
          };
        } else {
          this.log(`API health endpoint: UNEXPECTED STATUS ${response.status}`, 'warning');
          this.results.api = { 
            status: 'warning', 
            message: `Unexpected status: ${response.status}` 
          };
        }
      } else {
        this.log('API port is closed', 'error');
        this.results.api = { status: 'error', message: 'Port 3001 not accessible' };
      }
    } catch (error) {
      this.log(`API check failed: ${error.message}`, 'error');
      this.results.api = { status: 'error', message: error.message };
    }
  }

  async checkDashboard() {
    this.log('Checking Dashboard service...');
    
    try {
      const isConnected = await this.checkPort('dashboard', SERVICES.dashboard.port, SERVICES.dashboard.host);
      
      if (isConnected) {
        this.log('Dashboard port is open');
        
        // Test dashboard basic response
        const response = await axios.get(`${SERVICES.dashboard.url}`, { 
          timeout: 5000,
          validateStatus: (status) => status < 500 
        });
        
        if (response.status < 500) {
          this.log('Dashboard service: HEALTHY');
          this.results.dashboard = { 
            status: 'healthy', 
            message: `Dashboard responding (status: ${response.status})` 
          };
        } else {
          this.log(`Dashboard service: ERROR STATUS ${response.status}`, 'error');
          this.results.dashboard = { 
            status: 'error', 
            message: `Error status: ${response.status}` 
          };
        }
      } else {
        this.log('Dashboard port is closed', 'error');
        this.results.dashboard = { status: 'error', message: 'Port 3000 not accessible' };
      }
    } catch (error) {
      this.log(`Dashboard check failed: ${error.message}`, 'error');
      this.results.dashboard = { status: 'error', message: error.message };
    }
  }

  async checkAgent() {
    this.log('Checking Agent service...');
    
    try {
      const isConnected = await this.checkPort('agent', SERVICES.agent.port, SERVICES.agent.host);
      
      if (isConnected) {
        this.log('Agent port is open');
        
        // Test agent health endpoint
        try {
          const response = await axios.get(`${SERVICES.agent.url}/health`, { 
            timeout: 10000,
            validateStatus: (status) => status < 500 
          });
          
          if (response.status === 200) {
            this.log('Agent health endpoint: HEALTHY');
            this.results.agent = { 
              status: 'healthy', 
              message: 'Agent responding',
              details: response.data
            };
          } else if (response.status < 500) {
            this.log(`Agent service: RESPONDING (status: ${response.status})`, 'warning');
            this.results.agent = { 
              status: 'warning', 
              message: `Agent responding but not healthy (status: ${response.status})` 
            };
          } else {
            this.log(`Agent service: ERROR STATUS ${response.status}`, 'error');
            this.results.agent = { 
              status: 'error', 
              message: `Error status: ${response.status}` 
            };
          }
        } catch (axiosError) {
          this.log(`Agent health check error: ${axiosError.message}`, 'warning');
          this.results.agent = { 
            status: 'warning', 
            message: `Health endpoint error: ${axiosError.message}` 
          };
        }
      } else {
        this.log('Agent port is closed - this may be expected if agent is not running', 'warning');
        this.results.agent = { 
          status: 'warning', 
          message: 'Port 3002 not accessible (agent may not be running)' 
        };
      }
    } catch (error) {
      this.log(`Agent check failed: ${error.message}`, 'warning');
      this.results.agent = { 
        status: 'warning', 
        message: 'Agent not reachable (may not be running)' 
      };
    }
  }

  async checkDockerServices() {
    this.log('Checking Docker services...');
    
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      const { stdout } = await execPromise('docker-compose ps');
      this.log('Docker services status:');
      console.log(stdout);
      
      // Parse docker-compose output to check if services are running
      const lines = stdout.split('\n');
      const runningServices = lines.filter(line => line.includes('Up'));
      
      if (runningServices.length >= 2) { // At least MySQL and Redis
        this.log(`Docker services: ${runningServices.length} services running`);
      } else {
        this.log('Docker services: Insufficient services running', 'warning');
      }
    } catch (error) {
      this.log('Docker-compose check failed - Docker may not be running', 'warning');
    }
  }

  async checkEnvironment() {
    this.log('Checking environment configuration...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Check if .env file exists
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      this.log('Environment file: FOUND');
      
      // Check critical environment variables
      const envContent = fs.readFileSync(envPath, 'utf8');
      const criticalVars = ['DATABASE_URL', 'REDIS_URL', 'API_PORT'];
      
      for (const varName of criticalVars) {
        if (envContent.includes(`${varName}=`)) {
          this.log(`Environment variable ${varName}: SET`);
        } else {
          this.log(`Environment variable ${varName}: MISSING`, 'warning');
        }
      }
    } else {
      this.log('Environment file: NOT FOUND', 'warning');
      this.log('Consider copying .env.example to .env');
    }
  }

  async runVerification() {
    this.log('🔍 Proxy Manager Services Connectivity Verification');
    this.log('='.repeat(60));
    
    // Run all checks
    await this.checkDockerServices();
    await this.checkEnvironment();
    await this.checkMySQL();
    await this.checkRedis();
    await this.checkAPI();
    await this.checkDashboard();
    await this.checkAgent();
    
    // Print summary
    this.printSummary();
    
    // Return overall status
    const healthyServices = Object.values(this.results).filter(r => r.status === 'healthy').length;
    const totalServices = Object.keys(this.results).length;
    
    return {
      success: healthyServices >= 3, // At least MySQL, Redis, API should be healthy
      results: this.results,
      summary: `${healthyServices}/${totalServices} services healthy`
    };
  }

  printSummary() {
    this.log('\n📊 Services Connectivity Summary');
    this.log('='.repeat(60));
    
    const services = ['mysql', 'redis', 'api', 'dashboard', 'agent'];
    
    for (const service of services) {
      const result = this.results[service];
      if (result) {
        const icon = result.status === 'healthy' ? '✅' : 
                    result.status === 'warning' ? '⚠️' : '❌';
        this.log(`${icon} ${service.toUpperCase()}: ${result.message}`);
      }
    }
    
    this.log('='.repeat(60));
    
    const healthyCount = Object.values(this.results).filter(r => r.status === 'healthy').length;
    const totalCount = Object.keys(this.results).length;
    
    this.log(`Overall: ${healthyCount}/${totalCount} services healthy`);
    
    if (healthyCount >= 3) {
      this.log('🎉 Core services are ready for testing!');
    } else {
      this.log('⚠️  Some core services are missing. Check the setup guide.', 'warning');
    }
    
    this.log('\nTroubleshooting tips:');
    this.log('1. Ensure Docker is running: docker --version');
    this.log('2. Start services: docker-compose up -d');
    this.log('3. Check logs: docker-compose logs [service-name]');
    this.log('4. Verify .env file configuration');
    this.log('5. Check port conflicts: netstat -an | grep :300[0-2]');
  }
}

// Command line interface
async function main() {
  const verifier = new ServiceVerifier();
  const result = await verifier.runVerification();
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = ServiceVerifier;

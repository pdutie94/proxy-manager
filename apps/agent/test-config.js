const { ConfigRenderer } = require('./dist/config/renderer');
const path = require('path');

async function testConfigGeneration() {
  console.log('Testing config file generation...');
  
  const renderer = new ConfigRenderer();
  
  // Test event data
  const testEvent = {
    proxyId: 3,
    nodeId: 1,
    ipv6: '2001:db8::1441:559c:7279:8f0f',
    port: 10003,
    username: 'user_4fv3us',
    password: 'vlhmdza0bw89otsn',
    type: 'PROXY_CREATE'
  };
  
  try {
    // Create test config directory
    const testDir = path.join(__dirname, 'test-configs');
    renderer.configDir = testDir;
    
    console.log('Adding proxy to config...');
    await renderer.addProxy(testEvent);
    
    console.log('Config generation test completed!');
    console.log(`Check files in: ${testDir}`);
    
  } catch (error) {
    console.error('Config generation test failed:', error);
  }
}

testConfigGeneration();

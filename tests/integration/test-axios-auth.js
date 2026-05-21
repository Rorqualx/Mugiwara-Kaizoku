/**
 * Test Axios Basic Auth behavior
 */

const axios = require('axios');

async function testAxiosAuth() {
  console.log('Testing axios auth behavior...\n');
  
  // Test 1: Default behavior
  try {
    const response1 = await axios.post('http://localhost:6789/jsonrpc', {
      version: '1.1',
      method: 'status',
      params: [],
      id: 1
    }, {
      auth: {
        username: 'wrong',
        password: 'wrong'
      }
    });
    
    console.log('Test 1 - Default axios (no validateStatus):');
    console.log('  Response received (should have thrown!)');
    console.log('  Status:', response1.status);
    console.log('  Data:', response1.data);
  } catch (error) {
    console.log('Test 1 - Default axios (no validateStatus):');
    console.log('  ✅ Error thrown as expected');
    console.log('  Status:', error.response?.status);
  }
  
  // Test 2: With validateStatus that should reject 401
  try {
    const response2 = await axios.post('http://localhost:6789/jsonrpc', {
      version: '1.1',
      method: 'status',
      params: [],
      id: 2
    }, {
      auth: {
        username: 'wrong',
        password: 'wrong'
      },
      validateStatus: (status) => status >= 200 && status < 300
    });
    
    console.log('\nTest 2 - With explicit validateStatus:');
    console.log('  Response received (should have thrown!)');
    console.log('  Status:', response2.status);
    console.log('  Data:', response2.data);
  } catch (error) {
    console.log('\nTest 2 - With explicit validateStatus:');
    console.log('  ✅ Error thrown as expected');
    console.log('  Status:', error.response?.status);
  }
  
  // Test 3: With validateStatus that allows 401
  try {
    const response3 = await axios.post('http://localhost:6789/jsonrpc', {
      version: '1.1',
      method: 'status',
      params: [],
      id: 3
    }, {
      auth: {
        username: 'wrong',
        password: 'wrong'
      },
      validateStatus: (_status) => true
    });
    
    console.log('\nTest 3 - With validateStatus that allows all:');
    console.log('  Status:', response3.status);
    console.log('  Status Text:', response3.statusText);
    console.log('  Headers:', response3.headers);
    console.log('  Data:', response3.data);
  } catch (error) {
    console.log('\nTest 3 - With validateStatus that allows all:');
    console.log('  Error (unexpected):', error.message);
  }
}

testAxiosAuth().catch(console.error);

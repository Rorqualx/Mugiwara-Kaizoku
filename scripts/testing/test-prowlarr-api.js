#!/usr/bin/env node

/**
 * Test script to verify Prowlarr API endpoints
 * 
 * This script tests the actual Prowlarr API endpoints to ensure they're working correctly.
 * It will help identify if the issue is with the implementation or the Prowlarr instance.
 */

const https = require('https');
const http = require('http');
const url = require('url');

// Configuration - update these values with your Prowlarr instance details
const PROWLARR_URL = process.env.PROWLARR_URL || 'http://localhost:9696';
const PROWLARR_API_KEY = process.env.PROWLARR_API_KEY || 'your-api-key-here';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Make a request to Prowlarr API
 */
function makeRequest(endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${PROWLARR_URL}/api/v1${endpoint}`);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'X-Api-Key': PROWLARR_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    log(`\nTesting: ${method} ${parsedUrl.href}`, 'blue');

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            resolve({ success: true, data: jsonData, statusCode: res.statusCode });
          } catch (e) {
            resolve({ success: true, data: data, statusCode: res.statusCode });
          }
        } else {
          resolve({ success: false, error: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      reject({ success: false, error: error.message });
    });

    req.end();
  });
}

/**
 * Test all relevant Prowlarr endpoints
 */
async function testProwlarrEndpoints() {
  log('🧪 Testing Prowlarr API Endpoints', 'yellow');
  log(`📍 Prowlarr URL: ${PROWLARR_URL}`, 'yellow');
  log(`🔑 API Key: ${PROWLARR_API_KEY.substring(0, 10)}...`, 'yellow');

  const endpoints = [
    { path: '/system/status', name: 'System Status' },
    { path: '/indexer', name: 'Get All Indexers' },
    { path: '/indexerstatus', name: 'Indexer Status' },
    { path: '/indexer/schema', name: 'Indexer Schema' },
    { path: '/appprofile', name: 'App Profiles' },
    { path: '/tag', name: 'Tags' }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const result = await makeRequest(endpoint.path);
      
      if (result.success) {
        log(`✅ ${endpoint.name}: SUCCESS (${result.statusCode})`, 'green');
        
        // Show summary of data for indexers
        if (endpoint.path === '/indexer' && Array.isArray(result.data)) {
          log(`   Found ${result.data.length} indexer(s)`, 'green');
          result.data.slice(0, 3).forEach(indexer => {
            log(`   - ${indexer.name} (${indexer.protocol}, ${indexer.enabled ? 'Enabled' : 'Disabled'})`, 'green');
          });
          if (result.data.length > 3) {
            log(`   ... and ${result.data.length - 3} more`, 'green');
          }
        }
        
        results.push({ endpoint: endpoint.name, success: true });
      } else {
        log(`❌ ${endpoint.name}: FAILED (${result.statusCode})`, 'red');
        log(`   Error: ${result.error}`, 'red');
        results.push({ endpoint: endpoint.name, success: false, error: result.error });
      }
    } catch (error) {
      log(`❌ ${endpoint.name}: ERROR`, 'red');
      log(`   Error: ${error.error || error.message || error}`, 'red');
      results.push({ endpoint: endpoint.name, success: false, error: error.error || error.message });
    }
  }

  // Test incorrect endpoint to verify it doesn't exist
  log('\n📋 Testing incorrect endpoint to verify it returns 404:', 'yellow');
  try {
    const result = await makeRequest('/settings/indexers');
    if (!result.success && result.statusCode === 404) {
      log(`✅ Correctly returned 404 for /settings/indexers`, 'green');
    } else {
      log(`⚠️  Unexpected response for /settings/indexers: ${result.statusCode}`, 'yellow');
    }
  } catch (error) {
    log(`✅ /settings/indexers endpoint doesn't exist (as expected)`, 'green');
  }

  // Summary
  log('\n📊 Test Summary:', 'yellow');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  log(`   Successful: ${successful}`, 'green');
  log(`   Failed: ${failed}`, failed > 0 ? 'red' : 'green');

  if (failed > 0) {
    log('\n⚠️  Some tests failed. Please check:', 'yellow');
    log('   1. Is Prowlarr running?', 'yellow');
    log('   2. Is the URL correct?', 'yellow');
    log('   3. Is the API key valid?', 'yellow');
    log('   4. Are there any network/firewall issues?', 'yellow');
  } else {
    log('\n✅ All tests passed! Prowlarr API is working correctly.', 'green');
  }

  // Show current implementation paths
  log('\n📁 Current Implementation Files:', 'blue');
  log('   - src/api/prowlarrClient.ts (Main client)', 'blue');
  log('   - src/utils/prowlarrApi.ts (Utility functions)', 'blue');
  log('   - src/pages/api/prowlarr.ts (API proxy endpoint)', 'blue');
  log('   - src/components/settings/prowlarr/*.tsx (UI components)', 'blue');
}

// Run the tests
testProwlarrEndpoints().catch(error => {
  log(`\n❌ Fatal error: ${error.message || error}`, 'red');
  process.exit(1);
});

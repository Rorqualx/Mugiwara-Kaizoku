#!/usr/bin/env node

/**
 * Test script to verify shutdown functionality
 * Tests the shutdown mutation in different environments
 */

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/trpc';

async function testShutdown() {
  console.log('Testing shutdown functionality...\n');
  
  // First, let's get a session token by logging in
  console.log('1. Logging in to get session...');
  const loginResponse = await fetch('http://localhost:3001/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: 'admin@kaizoku.dev',
      password: 'admin123',
      csrfToken: '', // Would need to get this from the login page
    }),
    redirect: 'manual',
  });
  
  const cookies = loginResponse.headers.get('set-cookie');
  console.log('Login response status:', loginResponse.status);
  console.log('Cookies received:', cookies ? 'Yes' : 'No');
  
  // Now test the shutdown endpoint
  console.log('\n2. Testing shutdown mutation...');
  const shutdownPayload = {
    "0": {
      "json": {
        "force": false,
        "reason": "Testing shutdown functionality"
      }
    }
  };
  
  try {
    const response = await fetch(`${API_URL}/system.shutdown?batch=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || '',
      },
      body: JSON.stringify(shutdownPayload),
    });
    
    const result = await response.json();
    console.log('Shutdown response:', JSON.stringify(result, null, 2));
    
    if (result[0]?.result?.data?.json) {
      const data = result[0].result.data.json;
      console.log('\n3. Shutdown result:');
      console.log('   Success:', data.success);
      console.log('   Message:', data.message);
      console.log('   Is Docker:', data.isDocker);
      console.log('   Is Development:', data.isDevelopment);
      console.log('   Active Tasks:', data.activeTasks);
      
      if (data.success) {
        console.log('\n✅ Shutdown initiated successfully!');
        console.log('The application should stop within 3 seconds...');
      } else {
        console.log('\n⚠️ Shutdown was blocked:', data.message);
      }
    }
  } catch (error) {
    console.error('Error testing shutdown:', error.message);
    console.log('\nThis might mean the server has already stopped (which is expected for shutdown).');
  }
}

// Run the test
testShutdown().catch(console.error);
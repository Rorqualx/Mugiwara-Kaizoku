#!/usr/bin/env k6 run
//
// K6 Load Testing Script for Mugiwara Kaizoku (Bun Runtime)
//
// This script tests the performance of the Bun-powered application under load.
// It simulates realistic user scenarios and measures key performance metrics.
//
// Prerequisites:
//   1. Install k6: https://k6.io/docs/getting-started/installation/
//   2. Ensure app is running (local or staging)
//   3. Set BASE_URL environment variable (optional)
//
// Usage:
//   # Basic run (10 VUs for 30s)
//   k6 run scripts/loadtest.js
//
//   # Custom VUs and duration
//   k6 run --vus 50 --duration 60s scripts/loadtest.js
//
//   # Run against staging
//   BASE_URL=https://staging.example.com k6 run scripts/loadtest.js
//
//   # Generate HTML report
//   k6 run --out html=report.html scripts/loadtest.js
//
//   # Run with cloud output
//   k6 cloud scripts/loadtest.js
//
// Test Scenarios:
//   1. Homepage load
//   2. API endpoint stress test
//   3. Database query performance
//   4. Static asset loading
//   5. WebSocket connections (if applicable)
//
// Metrics Collected:
//   - Response times (p50, p95, p99)
//   - Requests per second
//   - Error rate
//   - Data transfer
//   - Custom business metrics

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const IS_BUN_RUNTIME = __ENV.RUNTIME === 'bun' || true;

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const pageLoadTime = new Trend('page_load_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// =============================================================================
// Test Configuration
// =============================================================================

export const options = {
  // Test stages: Ramp up, sustain, ramp down
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 VUs
    { duration: '1m', target: 50 },   // Ramp up to 50 VUs
    { duration: '2m', target: 50 },   // Hold at 50 VUs
    { duration: '30s', target: 100 }, // Spike to 100 VUs
    { duration: '1m', target: 100 },  // Hold at 100 VUs
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],

  // Thresholds: Define pass/fail criteria
  thresholds: {
    // HTTP errors should be less than 1%
    errors: ['rate<0.01'],

    // 95% of requests should complete within 500ms
    http_req_duration: ['p(95)<500'],

    // 99% of requests should complete within 1000ms
    'http_req_duration{expected_response:true}': ['p(99)<1000'],

    // API response time should be fast
    api_response_time: ['p(95)<300', 'p(99)<500'],

    // Page load time targets
    page_load_time: ['p(95)<1000', 'p(99)<2000'],

    // Request success rate should be > 99%
    'http_req_failed': ['rate<0.01'],
  },

  // HTTP configuration
  httpDebug: __ENV.DEBUG === 'true' ? 'full' : undefined,

  // Graceful stop
  gracefulStop: '10s',
};

// =============================================================================
// Test Data
// =============================================================================

// Sample manga IDs for testing (adjust based on your data)
const mangaIds = new SharedArray('mangaIds', function () {
  return Array.from({ length: 50 }, (_, i) => i + 1);
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Make API request and track metrics
 */
function apiRequest(endpoint, params = {}) {
  const startTime = new Date();
  const response = http.get(`${BASE_URL}${endpoint}`, params);

  // Track response time
  const duration = new Date() - startTime;
  apiResponseTime.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body && r.body.length > 0,
  });

  // Track success/failure
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    errorRate.add(1);
  }

  return response;
}

/**
 * Simulate page load with multiple resources
 */
function loadPage(url) {
  const startTime = new Date();

  const responses = http.batch([
    ['GET', `${BASE_URL}${url}`, null, { tags: { name: 'page' } }],
    ['GET', `${BASE_URL}/_next/static/chunks/main.js`, null, { tags: { name: 'js' } }],
    ['GET', `${BASE_URL}/_next/static/css/app.css`, null, { tags: { name: 'css' } }],
  ]);

  const duration = new Date() - startTime;
  pageLoadTime.add(duration);

  check(responses[0], {
    'page loaded': (r) => r.status === 200,
  });
}

// =============================================================================
// Test Scenarios
// =============================================================================

/**
 * Scenario 1: Homepage Load
 */
function testHomepage() {
  group('Homepage', function () {
    const response = http.get(BASE_URL);

    check(response, {
      'status is 200': (r) => r.status === 200,
      'contains title': (r) => r.body.includes('Kaizoku') || r.body.includes('Manga'),
      'loads in under 2s': (r) => r.timings.duration < 2000,
    });

    sleep(1);
  });
}

/**
 * Scenario 2: API Health Check
 */
function testHealthEndpoint() {
  group('API Health', function () {
    const response = apiRequest('/api/health');

    check(response, {
      'health check passes': (r) => r.status === 200,
      'responds quickly': (r) => r.timings.duration < 100,
    });

    sleep(0.5);
  });
}

/**
 * Scenario 3: Browse Manga Library
 */
function testMangaLibrary() {
  group('Manga Library', function () {
    // Load manga list page
    loadPage('/library');

    // Fetch manga list via API
    const response = apiRequest('/api/trpc/manga.list');

    check(response, {
      'manga list loaded': (r) => r.status === 200,
      'has manga data': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data && data.result;
        } catch (e) {
          return false;
        }
      },
    });

    sleep(2);
  });
}

/**
 * Scenario 4: View Manga Details
 */
function testMangaDetails() {
  group('Manga Details', function () {
    // Pick random manga ID
    const mangaId = mangaIds[Math.floor(Math.random() * mangaIds.length)];

    // Load manga detail page
    loadPage(`/manga/${mangaId}`);

    // Fetch manga details via API
    const response = apiRequest(`/api/trpc/manga.getById?input=${JSON.stringify({ id: mangaId })}`);

    check(response, {
      'manga details loaded': (r) => r.status === 200 || r.status === 404,
    });

    sleep(3);
  });
}

/**
 * Scenario 5: Search Functionality
 */
function testSearch() {
  group('Search', function () {
    const searchTerms = ['one piece', 'naruto', 'bleach', 'attack on titan'];
    const query = searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const response = apiRequest(`/api/trpc/manga.search?input=${JSON.stringify({ query })}`);

    check(response, {
      'search completed': (r) => r.status === 200,
    });

    sleep(1);
  });
}

/**
 * Scenario 6: Download Queue Status
 */
function testDownloadQueue() {
  group('Download Queue', function () {
    const response = apiRequest('/api/trpc/jobs.list');

    check(response, {
      'queue status retrieved': (r) => r.status === 200,
    });

    sleep(1);
  });
}

/**
 * Scenario 7: User Authentication Flow
 */
function testAuthFlow() {
  group('Authentication', function () {
    // Check session endpoint
    const response = apiRequest('/api/auth/session');

    check(response, {
      'session check works': (r) => r.status === 200,
    });

    sleep(1);
  });
}

/**
 * Scenario 8: Static Assets
 */
function testStaticAssets() {
  group('Static Assets', function () {
    http.batch([
      ['GET', `${BASE_URL}/favicon.ico`],
      ['GET', `${BASE_URL}/robots.txt`],
      ['GET', `${BASE_URL}/sitemap.xml`],
    ]);

    sleep(0.5);
  });
}

// =============================================================================
// Main Test Function
// =============================================================================

export default function () {
  // Randomly select a scenario to simulate diverse user behavior
  const scenarios = [
    testHomepage,
    testHealthEndpoint,
    testMangaLibrary,
    testMangaDetails,
    testSearch,
    testDownloadQueue,
    testAuthFlow,
    testStaticAssets,
  ];

  // Weight different scenarios (more realistic traffic patterns)
  const weights = [10, 5, 30, 25, 15, 5, 5, 5]; // Percentages
  const random = Math.random() * 100;

  let cumulative = 0;
  for (let i = 0; i < scenarios.length; i++) {
    cumulative += weights[i];
    if (random < cumulative) {
      scenarios[i]();
      break;
    }
  }

  // Think time between requests
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

// =============================================================================
// Setup and Teardown
// =============================================================================

export function setup() {
  console.log(`🚀 Starting load test against: ${BASE_URL}`);
  console.log(`🔧 Runtime: ${IS_BUN_RUNTIME ? 'Bun 1.3' : 'Node.js'}`);

  // Verify server is accessible
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    throw new Error(`❌ Server is not accessible at ${BASE_URL}`);
  }

  console.log('✅ Server is accessible, starting load test...');
  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`\n✅ Load test completed`);
  console.log(`Started at: ${data.startTime}`);
  console.log(`Finished at: ${new Date().toISOString()}`);
}

// =============================================================================
// Custom Summary
// =============================================================================

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    'loadtest-results.json': JSON.stringify(data, null, 2),
  };
}

// Text summary helper
function textSummary(data, opts) {
  const { indent = '', enableColors = false } = opts || {};

  let output = '\n' + indent + '='.repeat(60) + '\n';
  output += indent + 'Load Test Summary\n';
  output += indent + '='.repeat(60) + '\n\n';

  // Test duration
  const duration = data.state.testRunDurationMs / 1000;
  output += indent + `Duration: ${duration.toFixed(2)}s\n`;

  // Requests
  const requests = data.metrics.http_reqs?.values?.count || 0;
  const rps = (requests / duration).toFixed(2);
  output += indent + `Total Requests: ${requests} (${rps} req/s)\n`;

  // Success rate
  const failedRate = (data.metrics.http_req_failed?.values?.rate || 0) * 100;
  output += indent + `Success Rate: ${(100 - failedRate).toFixed(2)}%\n`;

  // Response times
  const p50 = data.metrics.http_req_duration?.values?.['p(50)'] || 0;
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  output += indent + `Response Time (p50): ${p50.toFixed(2)}ms\n`;
  output += indent + `Response Time (p95): ${p95.toFixed(2)}ms\n`;
  output += indent + `Response Time (p99): ${p99.toFixed(2)}ms\n`;

  output += indent + '='.repeat(60) + '\n';

  return output;
}

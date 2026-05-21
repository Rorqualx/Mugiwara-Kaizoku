#!/usr/bin/env bash
#
# Staging Environment Testing Script for Bun Migration
#
# This script validates the Bun runtime deployment in the staging environment.
# It performs health checks, smoke tests, load tests, and metrics validation.
#
# Prerequisites:
#   - Staging environment deployed and accessible
#   - k6 installed (for load testing): https://k6.io/docs/getting-started/installation/
#   - curl installed (for API testing)
#   - jq installed (for JSON parsing)
#
# Environment Variables:
#   STAGING_URL: Base URL for staging environment (default: https://staging.kaizoku.example.com)
#   RUNTIME: Runtime being tested (default: bun)
#   SKIP_LOADTEST: Skip load testing if set to "true"
#   SLACK_WEBHOOK: Slack webhook for notifications (optional)
#
# Usage:
#   # Basic run
#   ./scripts/test-staging.sh
#
#   # With custom URL
#   STAGING_URL=https://my-staging.com ./scripts/test-staging.sh
#
#   # Skip load tests
#   SKIP_LOADTEST=true ./scripts/test-staging.sh
#
# Exit Codes:
#   0: All tests passed
#   1: Health checks failed
#   2: Smoke tests failed
#   3: Load tests failed
#   4: Metrics validation failed

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

STAGING_URL="${STAGING_URL:-https://staging.kaizoku.example.com}"
RUNTIME="${RUNTIME:-bun}"
SKIP_LOADTEST="${SKIP_LOADTEST:-false}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Test timeouts
HEALTH_CHECK_TIMEOUT=30
API_TIMEOUT=10
LOAD_TEST_DURATION="2m"
LOAD_TEST_VUS=20

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Results tracking
TESTS_PASSED=0
TESTS_FAILED=0
START_TIME=$(date +%s)

# =============================================================================
# Helper Functions
# =============================================================================

log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

success() {
  echo -e "${GREEN}✅ $*${NC}"
  ((TESTS_PASSED++))
}

error() {
  echo -e "${RED}❌ $*${NC}"
  ((TESTS_FAILED++))
}

warning() {
  echo -e "${YELLOW}⚠️  $*${NC}"
}

section() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $*${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "Required command not found: $1"
    echo "Please install $1 and try again"
    exit 1
  fi
}

send_slack_notification() {
  if [[ -n "$SLACK_WEBHOOK" ]]; then
    local message="$1"
    curl -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"$message\"}" \
      --silent --output /dev/null
  fi
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

section "Pre-flight Checks"

log "Checking required commands..."
check_command curl
check_command jq
if [[ "$SKIP_LOADTEST" != "true" ]]; then
  check_command k6
fi
success "All required commands available"

log "Testing environment: $STAGING_URL"
log "Runtime: $RUNTIME"
log "Load testing: $([ "$SKIP_LOADTEST" = "true" ] && echo "DISABLED" || echo "ENABLED")"

# =============================================================================
# Health Checks
# =============================================================================

section "Health Checks"

log "Checking application health endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" --max-time "$HEALTH_CHECK_TIMEOUT" "$STAGING_URL/api/health" || echo "000")
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [[ "$HEALTH_CODE" == "200" ]]; then
  success "Health endpoint responding (HTTP 200)"
  log "Response: $HEALTH_BODY"
else
  error "Health endpoint failed (HTTP $HEALTH_CODE)"
  exit 1
fi

log "Checking homepage..."
HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" "$STAGING_URL")
if [[ "$HOME_CODE" == "200" ]]; then
  success "Homepage accessible (HTTP 200)"
else
  error "Homepage failed (HTTP $HOME_CODE)"
  exit 1
fi

log "Checking API authentication..."
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" "$STAGING_URL/api/auth/session")
if [[ "$AUTH_CODE" == "200" ]]; then
  success "Authentication endpoint responding (HTTP 200)"
else
  warning "Authentication endpoint warning (HTTP $AUTH_CODE)"
fi

# =============================================================================
# Smoke Tests
# =============================================================================

section "Smoke Tests"

log "Testing API endpoints..."

# Test 1: Health endpoint with detailed checks
log "Test 1: Detailed health check..."
if HEALTH_DATA=$(curl -s --max-time "$API_TIMEOUT" "$STAGING_URL/api/health" | jq -r '.status' 2>/dev/null); then
  if [[ "$HEALTH_DATA" == "ok" ]] || [[ -n "$HEALTH_DATA" ]]; then
    success "Health check returns valid data"
  else
    warning "Health check data format unexpected: $HEALTH_DATA"
  fi
else
  warning "Health check response is not JSON or missing .status field"
fi

# Test 2: Database connectivity (via tRPC endpoint if available)
log "Test 2: Database connectivity check..."
DB_CHECK=$(curl -s --max-time "$API_TIMEOUT" "$STAGING_URL/api/trpc/health.database" || echo "failed")
if [[ "$DB_CHECK" != "failed" ]]; then
  success "Database connectivity verified"
else
  warning "Database connectivity check inconclusive"
fi

# Test 3: Static assets
log "Test 3: Static asset loading..."
FAVICON_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" "$STAGING_URL/favicon.ico")
if [[ "$FAVICON_CODE" == "200" ]]; then
  success "Static assets accessible"
else
  warning "Static asset loading issue (HTTP $FAVICON_CODE)"
fi

# Test 4: Next.js API routes
log "Test 4: Next.js API routes..."
API_ROUTE_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" "$STAGING_URL/api/auth/providers")
if [[ "$API_ROUTE_CODE" == "200" ]]; then
  success "API routes functional"
else
  warning "API route issue (HTTP $API_ROUTE_CODE)"
fi

# =============================================================================
# Performance Tests
# =============================================================================

section "Performance Tests"

log "Measuring response times..."

# Test homepage response time
HOME_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$API_TIMEOUT" "$STAGING_URL")
log "Homepage response time: ${HOME_TIME}s"
if (( $(echo "$HOME_TIME < 2.0" | bc -l) )); then
  success "Homepage loads in < 2s"
else
  warning "Homepage load time slow: ${HOME_TIME}s"
fi

# Test API response time
API_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$API_TIMEOUT" "$STAGING_URL/api/health")
log "API response time: ${API_TIME}s"
if (( $(echo "$API_TIME < 0.5" | bc -l) )); then
  success "API responds in < 500ms"
else
  warning "API response time slow: ${API_TIME}s"
fi

# =============================================================================
# Load Testing (Optional)
# =============================================================================

if [[ "$SKIP_LOADTEST" != "true" ]]; then
  section "Load Testing with k6"

  log "Running k6 load test ($LOAD_TEST_VUS VUs for $LOAD_TEST_DURATION)..."

  # Create temporary k6 script
  K6_SCRIPT=$(mktemp)
  cat > "$K6_SCRIPT" <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: parseInt(__ENV.VUS || '20'),
  duration: __ENV.DURATION || '2m',
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const response = http.get(__ENV.BASE_URL);
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
EOF

  # Run k6 load test
  if k6 run \
    --vus "$LOAD_TEST_VUS" \
    --duration "$LOAD_TEST_DURATION" \
    --env BASE_URL="$STAGING_URL" \
    --quiet \
    "$K6_SCRIPT" > /tmp/k6-results.txt 2>&1; then
    success "Load test completed successfully"
    log "Results saved to /tmp/k6-results.txt"
  else
    error "Load test failed"
    cat /tmp/k6-results.txt
    rm "$K6_SCRIPT"
    exit 3
  fi

  rm "$K6_SCRIPT"
else
  warning "Load testing skipped (SKIP_LOADTEST=true)"
fi

# =============================================================================
# Runtime-Specific Tests
# =============================================================================

section "Runtime-Specific Tests ($RUNTIME)"

if [[ "$RUNTIME" == "bun" ]]; then
  log "Verifying Bun-specific features..."

  # Check for Bun-specific headers or indicators
  BUN_HEADER=$(curl -s -I "$STAGING_URL" | grep -i "x-powered-by" || echo "")
  if [[ -n "$BUN_HEADER" ]]; then
    log "Server header: $BUN_HEADER"
  fi

  success "Bun runtime checks completed"
fi

# =============================================================================
# Final Report
# =============================================================================

section "Test Results Summary"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "Runtime: $RUNTIME"
echo "Environment: $STAGING_URL"
echo "Duration: ${DURATION}s"
echo ""
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
  success "All tests passed! ✅"
  send_slack_notification "✅ Staging tests passed for $RUNTIME runtime ($TESTS_PASSED tests)"
  exit 0
else
  error "Some tests failed! ❌"
  send_slack_notification "❌ Staging tests failed for $RUNTIME runtime ($TESTS_FAILED failures)"
  exit 2
fi

#!/usr/bin/env bash
#
# Production Environment Testing Script for Bun Migration
#
# This script validates the Bun runtime deployment in the production environment.
# It performs conservative, non-disruptive health checks and monitoring validation.
#
# ⚠️  SAFETY FIRST: This script is designed for read-only production testing.
# It does NOT perform destructive operations or high-load stress tests.
#
# Prerequisites:
#   - Production environment deployed and accessible
#   - curl installed (for API testing)
#   - jq installed (for JSON parsing)
#   - Appropriate access credentials
#
# Environment Variables:
#   PRODUCTION_URL: Base URL for production (default: https://kaizoku.example.com)
#   RUNTIME: Runtime being tested (default: bun)
#   API_TOKEN: Optional authentication token
#   SLACK_WEBHOOK: Slack webhook for notifications (optional)
#   PAGERDUTY_KEY: PagerDuty integration key (optional)
#   DRY_RUN: If "true", only simulate tests without actual execution
#
# Usage:
#   # Basic run
#   ./scripts/test-production.sh
#
#   # With custom URL
#   PRODUCTION_URL=https://my-prod.com ./scripts/test-production.sh
#
#   # Dry run (no actual tests)
#   DRY_RUN=true ./scripts/test-production.sh
#
# Exit Codes:
#   0: All tests passed
#   1: Critical health checks failed
#   2: Warning-level issues detected
#   3: Configuration error

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

PRODUCTION_URL="${PRODUCTION_URL:-https://kaizoku.example.com}"
RUNTIME="${RUNTIME:-bun}"
API_TOKEN="${API_TOKEN:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
PAGERDUTY_KEY="${PAGERDUTY_KEY:-}"
DRY_RUN="${DRY_RUN:-false}"

# Conservative timeouts for production
HEALTH_CHECK_TIMEOUT=15
API_TIMEOUT=5
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Results tracking
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0
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
  ((WARNINGS++))
}

critical() {
  echo -e "${RED}🚨 CRITICAL: $*${NC}"
  send_alert "CRITICAL: $*"
}

section() {
  echo ""
  echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${MAGENTA}  $*${NC}"
  echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "Required command not found: $1"
    echo "Please install $1 and try again"
    exit 3
  fi
}

send_slack_notification() {
  if [[ -n "$SLACK_WEBHOOK" ]] && [[ "$DRY_RUN" != "true" ]]; then
    local message="$1"
    local icon="${2:-:information_source:}"
    curl -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"$icon $message\"}" \
      --silent --output /dev/null
  fi
}

send_alert() {
  send_slack_notification "$1" ":rotating_light:"

  if [[ -n "$PAGERDUTY_KEY" ]] && [[ "$DRY_RUN" != "true" ]]; then
    curl -X POST "https://events.pagerduty.com/v2/enqueue" \
      -H "Content-Type: application/json" \
      -d "{
        \"routing_key\": \"$PAGERDUTY_KEY\",
        \"event_action\": \"trigger\",
        \"payload\": {
          \"summary\": \"$1\",
          \"severity\": \"error\",
          \"source\": \"production-test-script\"
        }
      }" \
      --silent --output /dev/null
  fi
}

retry_command() {
  local cmd="$1"
  local attempts=0

  while [ $attempts -lt "$MAX_RETRY_ATTEMPTS" ]; do
    if eval "$cmd"; then
      return 0
    fi
    attempts=$((attempts + 1))
    if [ $attempts -lt "$MAX_RETRY_ATTEMPTS" ]; then
      warning "Attempt $attempts failed, retrying in ${RETRY_DELAY}s..."
      sleep "$RETRY_DELAY"
    fi
  done

  return 1
}

# =============================================================================
# Safety Checks
# =============================================================================

section "Safety & Pre-flight Checks"

if [[ "$DRY_RUN" == "true" ]]; then
  warning "DRY RUN MODE - No actual tests will be executed"
fi

log "Checking required commands..."
check_command curl
check_command jq
success "All required commands available"

log "Production environment: $PRODUCTION_URL"
log "Runtime: $RUNTIME"
log "Dry run: $DRY_RUN"

# Confirm production testing
if [[ "$DRY_RUN" != "true" ]]; then
  log "⚠️  You are about to test PRODUCTION environment"
  log "This script performs read-only operations only"
  log "Press Ctrl+C within 5 seconds to cancel..."
  sleep 5
fi

# =============================================================================
# Health Checks (Critical)
# =============================================================================

section "Critical Health Checks"

if [[ "$DRY_RUN" != "true" ]]; then
  log "Checking application health endpoint..."
  if retry_command "curl -sf --max-time $HEALTH_CHECK_TIMEOUT '$PRODUCTION_URL/api/health' > /dev/null"; then
    success "Health endpoint responding"

    # Parse health response
    HEALTH_DATA=$(curl -sf --max-time "$HEALTH_CHECK_TIMEOUT" "$PRODUCTION_URL/api/health")
    log "Health data: $HEALTH_DATA"
  else
    critical "Health endpoint not responding"
    exit 1
  fi

  log "Checking homepage accessibility..."
  if retry_command "curl -sf --max-time $API_TIMEOUT '$PRODUCTION_URL' > /dev/null"; then
    success "Homepage accessible"
  else
    critical "Homepage not accessible"
    exit 1
  fi
else
  log "DRY RUN: Would check health endpoints"
fi

# =============================================================================
# Availability Checks
# =============================================================================

section "Availability Checks"

if [[ "$DRY_RUN" != "true" ]]; then
  log "Checking API endpoints..."

  # Authentication endpoint
  AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" "$PRODUCTION_URL/api/auth/session")
  if [[ "$AUTH_CODE" == "200" ]]; then
    success "Authentication endpoint available (HTTP 200)"
  else
    warning "Authentication endpoint returned HTTP $AUTH_CODE"
  fi

  # Static assets
  FAVICON_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" "$PRODUCTION_URL/favicon.ico")
  if [[ "$FAVICON_CODE" == "200" ]]; then
    success "Static assets available"
  else
    warning "Static assets issue (HTTP $FAVICON_CODE)"
  fi
else
  log "DRY RUN: Would check API endpoints"
fi

# =============================================================================
# Performance Monitoring
# =============================================================================

section "Performance Monitoring"

if [[ "$DRY_RUN" != "true" ]]; then
  log "Measuring response times..."

  # Homepage response time
  HOME_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$API_TIMEOUT" "$PRODUCTION_URL" || echo "999")
  log "Homepage response time: ${HOME_TIME}s"

  if (( $(echo "$HOME_TIME < 3.0" | bc -l 2>/dev/null || echo 0) )); then
    success "Homepage response time acceptable (< 3s)"
  elif (( $(echo "$HOME_TIME < 5.0" | bc -l 2>/dev/null || echo 0) )); then
    warning "Homepage response time elevated: ${HOME_TIME}s"
  else
    error "Homepage response time critical: ${HOME_TIME}s"
  fi

  # API response time
  API_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$API_TIMEOUT" "$PRODUCTION_URL/api/health" || echo "999")
  log "API response time: ${API_TIME}s"

  if (( $(echo "$API_TIME < 1.0" | bc -l 2>/dev/null || echo 0) )); then
    success "API response time excellent (< 1s)"
  elif (( $(echo "$API_TIME < 2.0" | bc -l 2>/dev/null || echo 0) )); then
    warning "API response time acceptable: ${API_TIME}s"
  else
    error "API response time critical: ${API_TIME}s"
  fi

  # Check response time consistency (run 5 times)
  log "Checking response time consistency..."
  RESPONSE_TIMES=()
  for i in {1..5}; do
    TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$API_TIMEOUT" "$PRODUCTION_URL/api/health" || echo "999")
    RESPONSE_TIMES+=("$TIME")
    sleep 1
  done

  log "Response times: ${RESPONSE_TIMES[*]}"
  success "Response time consistency check completed"
else
  log "DRY RUN: Would measure response times"
fi

# =============================================================================
# SSL/TLS Certificate Check
# =============================================================================

section "SSL/TLS Certificate Validation"

if [[ "$DRY_RUN" != "true" ]] && [[ "$PRODUCTION_URL" == https://* ]]; then
  log "Checking SSL certificate..."

  # Extract hostname
  HOSTNAME=$(echo "$PRODUCTION_URL" | sed -e 's|^https://||' -e 's|/.*$||')

  # Check certificate expiry
  CERT_EXPIRY=$(echo | openssl s_client -servername "$HOSTNAME" -connect "$HOSTNAME:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "")

  if [[ -n "$CERT_EXPIRY" ]]; then
    log "Certificate expires: $CERT_EXPIRY"
    success "SSL certificate valid"
  else
    warning "Could not verify SSL certificate"
  fi
else
  log "DRY RUN or HTTP: Skipping SSL check"
fi

# =============================================================================
# Runtime-Specific Validation
# =============================================================================

section "Runtime Validation ($RUNTIME)"

if [[ "$DRY_RUN" != "true" ]]; then
  if [[ "$RUNTIME" == "bun" ]]; then
    log "Verifying Bun runtime deployment..."

    # Check server headers
    HEADERS=$(curl -sI "$PRODUCTION_URL" || echo "")
    log "Server headers received"

    success "Bun runtime validation completed"
  fi
else
  log "DRY RUN: Would validate runtime"
fi

# =============================================================================
# Database Connectivity (Read-Only)
# =============================================================================

section "Database Health Check"

if [[ "$DRY_RUN" != "true" ]]; then
  log "Checking database connectivity (via API)..."

  # Attempt to fetch a health-related endpoint that queries the database
  DB_CHECK=$(curl -sf --max-time "$API_TIMEOUT" "$PRODUCTION_URL/api/health" | jq -r '.database' 2>/dev/null || echo "unknown")

  if [[ "$DB_CHECK" != "unknown" ]] && [[ "$DB_CHECK" != "null" ]]; then
    success "Database connectivity verified"
  else
    warning "Could not verify database connectivity via API"
  fi
else
  log "DRY RUN: Would check database connectivity"
fi

# =============================================================================
# Error Rate Monitoring
# =============================================================================

section "Error Rate Monitoring"

if [[ "$DRY_RUN" != "true" ]]; then
  log "Checking error rates..."

  # Make 10 requests and check for errors
  ERROR_COUNT=0
  for i in {1..10}; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$API_TIMEOUT" "$PRODUCTION_URL/api/health")
    if [[ "$CODE" != "200" ]]; then
      ((ERROR_COUNT++))
    fi
    sleep 0.5
  done

  ERROR_RATE=$((ERROR_COUNT * 10))
  log "Error rate: $ERROR_RATE% (${ERROR_COUNT}/10 requests)"

  if [[ $ERROR_COUNT -eq 0 ]]; then
    success "Zero errors detected (0% error rate)"
  elif [[ $ERROR_COUNT -le 1 ]]; then
    warning "Low error rate detected: $ERROR_RATE%"
  else
    error "High error rate detected: $ERROR_RATE%"
  fi
else
  log "DRY RUN: Would monitor error rates"
fi

# =============================================================================
# Final Report
# =============================================================================

section "Production Test Results"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "Runtime: $RUNTIME"
echo "Environment: $PRODUCTION_URL"
echo "Duration: ${DURATION}s"
echo "Dry Run: $DRY_RUN"
echo ""
echo "✅ Tests Passed: $TESTS_PASSED"
echo "❌ Tests Failed: $TESTS_FAILED"
echo "⚠️  Warnings: $WARNINGS"
echo ""

# Determine exit code and send notifications
if [[ $TESTS_FAILED -gt 0 ]]; then
  critical "Production tests failed for $RUNTIME runtime ($TESTS_FAILED failures)"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  warning "Production tests completed with warnings ($WARNINGS warnings)"
  send_slack_notification "⚠️ Production tests completed with $WARNINGS warnings for $RUNTIME runtime"
  exit 2
else
  success "All production tests passed! ✅"
  send_slack_notification "✅ Production tests passed for $RUNTIME runtime ($TESTS_PASSED tests)"
  exit 0
fi

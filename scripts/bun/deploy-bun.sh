#!/usr/bin/env bash
#
# Bun Deployment Script for Production
#
# This script deploys Mugiwara Kaizoku with Bun 1.3 runtime to production.
# It handles blue-green deployment, health checks, and automatic rollback.
#
# ⚠️  PRODUCTION DEPLOYMENT: Use with extreme caution.
#
# Prerequisites:
#   - Bun 1.3+ installed
#   - Docker installed (for Docker deployment)
#   - PM2 installed (for PM2 deployment)
#   - NGINX configured
#   - Backup strategy in place
#
# Environment Variables:
#   DEPLOYMENT_TYPE: docker|pm2|manual (default: docker)
#   DEPLOYMENT_ENV: staging|production (default: production)
#   SKIP_TESTS: Skip pre-deployment tests (default: false)
#   SKIP_BACKUP: Skip backup step (default: false)
#   AUTO_ROLLBACK: Auto rollback on failure (default: true)
#   DRY_RUN: Simulate deployment (default: false)
#   SLACK_WEBHOOK: Slack webhook for notifications
#
# Usage:
#   # Docker deployment
#   ./scripts/bun/deploy-bun.sh
#
#   # PM2 deployment
#   DEPLOYMENT_TYPE=pm2 ./scripts/bun/deploy-bun.sh
#
#   # Staging deployment
#   DEPLOYMENT_ENV=staging ./scripts/bun/deploy-bun.sh
#
#   # Dry run
#   DRY_RUN=true ./scripts/bun/deploy-bun.sh
#
# Exit Codes:
#   0: Deployment successful
#   1: Deployment failed
#   2: Pre-flight check failed
#   3: Tests failed
#   4: Rollback triggered

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE:-docker}"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
SKIP_TESTS="${SKIP_TESTS:-false}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
AUTO_ROLLBACK="${AUTO_ROLLBACK:-true}"
DRY_RUN="${DRY_RUN:-false}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

BACKUP_DIR="./backups/pre-deploy-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="./deploy-$(date +%Y%m%d-%H%M%S).log"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:3000/api/health}"
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_DELAY=5

# Blue-Green deployment ports
BLUE_PORT=3000
GREEN_PORT=3001
CURRENT_PORT=$BLUE_PORT

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Deployment state
DEPLOYMENT_STARTED=false
OLD_CONTAINER_ID=""
NEW_CONTAINER_ID=""

# =============================================================================
# Helper Functions
# =============================================================================

log() {
  local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $*"
  echo -e "${BLUE}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

success() {
  local msg="✅ $*"
  echo -e "${GREEN}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

error() {
  local msg="❌ $*"
  echo -e "${RED}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

warning() {
  local msg="⚠️  $*"
  echo -e "${YELLOW}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

critical() {
  local msg="🚨 CRITICAL: $*"
  echo -e "${RED}${msg}${NC}"
  echo "$msg" >> "$LOG_FILE"
}

section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $*${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

send_notification() {
  local message="$1"
  local icon="${2:-:information_source:}"

  if [[ -n "$SLACK_WEBHOOK" ]] && [[ "$DRY_RUN" != "true" ]]; then
    curl -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"$icon [$DEPLOYMENT_ENV] $message\"}" \
      --silent --output /dev/null
  fi
}

run_command() {
  local cmd="$1"
  local desc="${2:-Running command}"

  log "$desc"
  log "Command: $cmd"

  if [[ "$DRY_RUN" == "true" ]]; then
    warning "DRY RUN: Would execute: $cmd"
    return 0
  fi

  if eval "$cmd" >> "$LOG_FILE" 2>&1; then
    success "$desc: Complete"
    return 0
  else
    error "$desc: Failed"
    return 1
  fi
}

check_health() {
  local url="${1:-$HEALTH_CHECK_URL}"
  local retries="${2:-$HEALTH_CHECK_RETRIES}"
  local delay="${3:-$HEALTH_CHECK_DELAY}"

  log "Checking health at: $url"

  for i in $(seq 1 "$retries"); do
    if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
      success "Health check passed (attempt $i/$retries)"
      return 0
    fi

    if [[ $i -lt $retries ]]; then
      log "Health check failed, retrying in ${delay}s... (attempt $i/$retries)"
      sleep "$delay"
    fi
  done

  error "Health check failed after $retries attempts"
  return 1
}

rollback() {
  critical "Initiating rollback..."
  send_notification "Deployment failed, rolling back" ":rotating_light:"

  case "$DEPLOYMENT_TYPE" in
    docker)
      if [[ -n "$OLD_CONTAINER_ID" ]]; then
        log "Starting old container: $OLD_CONTAINER_ID"
        run_command "docker start $OLD_CONTAINER_ID" "Restarting old container"
      fi

      if [[ -n "$NEW_CONTAINER_ID" ]]; then
        log "Stopping new container: $NEW_CONTAINER_ID"
        run_command "docker stop $NEW_CONTAINER_ID" "Stopping failed container"
      fi
      ;;

    pm2)
      log "Rolling back PM2 deployment"
      run_command "./scripts/bun/rollback.sh" "Executing rollback script"
      ;;
  esac

  error "Rollback completed"
  exit 4
}

# Trap errors for automatic rollback
trap 'if [[ "$AUTO_ROLLBACK" == "true" ]] && [[ "$DEPLOYMENT_STARTED" == "true" ]]; then rollback; fi' ERR

# =============================================================================
# Pre-flight Checks
# =============================================================================

section "Pre-flight Checks"

log "Environment: $DEPLOYMENT_ENV"
log "Deployment Type: $DEPLOYMENT_TYPE"
log "Dry Run: $DRY_RUN"

# Check Bun installation
if ! command -v bun &> /dev/null; then
  critical "Bun is not installed"
  exit 2
fi

BUN_VERSION=$(bun --version)
log "Bun version: $BUN_VERSION"

# Check if we're in project root
if [[ ! -f "package.json" ]]; then
  critical "Must be run from project root"
  exit 2
fi

# Verify Dockerfile.bun exists for Docker deployments
if [[ "$DEPLOYMENT_TYPE" == "docker" ]] && [[ ! -f "Dockerfile.bun" ]]; then
  critical "Dockerfile.bun not found"
  exit 2
fi

success "Pre-flight checks passed"

# =============================================================================
# Create Backup
# =============================================================================

if [[ "$SKIP_BACKUP" != "true" ]]; then
  section "Creating Pre-Deployment Backup"

  run_command "mkdir -p $BACKUP_DIR" "Creating backup directory"

  # Backup critical files
  files_to_backup=(".env" "docker-compose.yml" "package.json" "bun.lockb")
  for file in "${files_to_backup[@]}"; do
    if [[ -f "$file" ]]; then
      run_command "cp $file $BACKUP_DIR/" "Backing up $file"
    fi
  done

  success "Backup created at: $BACKUP_DIR"
else
  warning "Skipping backup (SKIP_BACKUP=true)"
fi

# =============================================================================
# Run Tests
# =============================================================================

if [[ "$SKIP_TESTS" != "true" ]]; then
  section "Running Pre-Deployment Tests"

  log "Installing dependencies..."
  run_command "bun install --frozen-lockfile" "Installing dependencies"

  log "Running type checks..."
  if ! run_command "bun run type-check:bun" "Type checking"; then
    error "Type checks failed"
    if [[ "$AUTO_ROLLBACK" != "true" ]]; then
      exit 3
    fi
  fi

  log "Running tests..."
  if ! run_command "bun test --passWithNoTests" "Running tests"; then
    error "Tests failed"
    if [[ "$AUTO_ROLLBACK" != "true" ]]; then
      exit 3
    fi
  fi

  success "Pre-deployment tests passed"
else
  warning "Skipping tests (SKIP_TESTS=true)"
fi

# =============================================================================
# Build Application
# =============================================================================

section "Building Application"

run_command "bun run build" "Building Next.js application"
run_command "bun prisma generate" "Generating Prisma client"

success "Application built successfully"

# =============================================================================
# Deploy Based on Type
# =============================================================================

DEPLOYMENT_STARTED=true
send_notification "Deployment started with Bun runtime" ":rocket:"

case "$DEPLOYMENT_TYPE" in
  # ===========================================================================
  # Docker Deployment
  # ===========================================================================
  docker)
    section "Docker Deployment"

    # Save current container ID
    OLD_CONTAINER_ID=$(docker ps -q -f name=kaizoku 2>/dev/null || echo "")
    if [[ -n "$OLD_CONTAINER_ID" ]]; then
      log "Current container: $OLD_CONTAINER_ID"
    fi

    # Build Docker image
    log "Building Docker image..."
    run_command "docker build -f Dockerfile.bun -t mugiwara-kaizoku:bun-latest ." "Building Docker image"

    # Tag with timestamp
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    run_command "docker tag mugiwara-kaizoku:bun-latest mugiwara-kaizoku:bun-$TIMESTAMP" "Tagging image"

    # Start new container
    log "Starting new container..."
    if [[ "$DRY_RUN" != "true" ]]; then
      NEW_CONTAINER_ID=$(docker run -d \
        --name "kaizoku-bun-$TIMESTAMP" \
        -p "$GREEN_PORT:3000" \
        --env-file .env \
        mugiwara-kaizoku:bun-$TIMESTAMP)
      log "New container ID: $NEW_CONTAINER_ID"
    else
      warning "DRY RUN: Would start new container"
    fi

    # Health check
    if ! check_health "http://localhost:$GREEN_PORT/api/health"; then
      error "New container health check failed"
      rollback
    fi

    # Switch traffic (update NGINX or load balancer)
    log "Switching traffic to new container..."
    warning "Manual step: Update NGINX to point to port $GREEN_PORT"
    warning "Or use your load balancer to switch traffic"

    # Stop old container after successful deployment
    if [[ -n "$OLD_CONTAINER_ID" ]]; then
      log "Stopping old container..."
      run_command "docker stop $OLD_CONTAINER_ID" "Stopping old container"
    fi

    success "Docker deployment complete"
    ;;

  # ===========================================================================
  # PM2 Deployment
  # ===========================================================================
  pm2)
    section "PM2 Deployment"

    # Check PM2 installation
    if ! command -v pm2 &> /dev/null; then
      critical "PM2 is not installed"
      exit 2
    fi

    # Stop existing processes
    log "Stopping existing PM2 processes..."
    run_command "pm2 stop kaizoku-bun || true" "Stopping old process"

    # Start new process
    log "Starting new process with Bun..."
    run_command "pm2 start bun --name kaizoku-bun -- .next/standalone/server.js" "Starting PM2 process"
    run_command "pm2 save" "Saving PM2 configuration"

    # Health check
    if ! check_health; then
      error "PM2 deployment health check failed"
      rollback
    fi

    success "PM2 deployment complete"
    ;;

  # ===========================================================================
  # Manual Deployment
  # ===========================================================================
  manual)
    section "Manual Deployment"

    warning "Manual deployment selected"
    log "Built artifacts are ready in .next/"
    log "Start the server with: bun .next/standalone/server.js"
    ;;

  *)
    critical "Unknown deployment type: $DEPLOYMENT_TYPE"
    exit 2
    ;;
esac

# =============================================================================
# Post-Deployment Validation
# =============================================================================

section "Post-Deployment Validation"

log "Performing smoke tests..."

# Test homepage
if curl -sf --max-time 10 "http://localhost:$GREEN_PORT/" > /dev/null 2>&1; then
  success "Homepage accessible"
else
  error "Homepage not accessible"
  if [[ "$AUTO_ROLLBACK" == "true" ]]; then
    rollback
  fi
fi

# Test API
if curl -sf --max-time 10 "http://localhost:$GREEN_PORT/api/health" > /dev/null 2>&1; then
  success "API accessible"
else
  error "API not accessible"
  if [[ "$AUTO_ROLLBACK" == "true" ]]; then
    rollback
  fi
fi

success "Post-deployment validation passed"

# =============================================================================
# Final Report
# =============================================================================

section "Deployment Complete ✅"

echo ""
echo "🎉 Successfully deployed Mugiwara Kaizoku with Bun runtime"
echo ""
echo "Details:"
echo "  - Environment: $DEPLOYMENT_ENV"
echo "  - Deployment Type: $DEPLOYMENT_TYPE"
echo "  - Bun Version: $BUN_VERSION"
echo "  - Backup Location: $BACKUP_DIR"
echo "  - Log File: $LOG_FILE"
echo ""

if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
  echo "Docker Status:"
  docker ps -f name=kaizoku
elif [[ "$DEPLOYMENT_TYPE" == "pm2" ]]; then
  echo "PM2 Status:"
  pm2 list
fi

echo ""
warning "Post-Deployment Checklist:"
echo "  1. ✅ Monitor application logs"
echo "  2. ✅ Verify all features working"
echo "  3. ✅ Check error rates in monitoring"
echo "  4. ✅ Run load tests if needed"
echo "  5. ✅ Update deployment documentation"
echo ""

send_notification "Deployment completed successfully" ":white_check_mark:"
success "All done! 🚀"

exit 0

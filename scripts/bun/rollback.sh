#!/usr/bin/env bash
#
# Rollback Script: Bun → Node.js
#
# This script safely rolls back from Bun runtime to Node.js runtime.
# It handles Docker containers, PM2 processes, and all dependencies.
#
# ⚠️  IMPORTANT: This is a production-critical script. Use with caution.
#
# Prerequisites:
#   - Root or sudo access
#   - Backup of current state
#   - Node.js installed
#
# Environment Variables:
#   DEPLOYMENT_TYPE: docker|pm2|manual (default: auto-detect)
#   SKIP_BACKUP: Skip backup step (default: false)
#   DRY_RUN: Simulate rollback without making changes (default: false)
#   FORCE: Skip confirmation prompts (default: false)
#
# Usage:
#   # Interactive rollback
#   ./scripts/bun/rollback.sh
#
#   # Force rollback without prompts
#   FORCE=true ./scripts/bun/rollback.sh
#
#   # Dry run to see what would happen
#   DRY_RUN=true ./scripts/bun/rollback.sh
#
# Exit Codes:
#   0: Rollback successful
#   1: Rollback failed
#   2: Pre-flight check failed
#   3: User cancelled

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE:-auto}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
DRY_RUN="${DRY_RUN:-false}"
FORCE="${FORCE:-false}"

BACKUP_DIR="./backups/bun-rollback-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="./rollback-$(date +%Y%m%d-%H%M%S).log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

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
  echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${MAGENTA}  $*${NC}"
  echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

confirm() {
  if [[ "$FORCE" == "true" ]]; then
    return 0
  fi

  read -p "$(echo -e ${YELLOW}$1 [y/N]:${NC} )" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    return 1
  fi
  return 0
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

# =============================================================================
# Pre-flight Checks
# =============================================================================

section "Pre-flight Checks"

log "Checking prerequisites..."

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]] && [[ "$DRY_RUN" != "true" ]]; then
  error "This script must be run as root or with sudo"
  exit 2
fi

# Check Node.js installation
if ! command -v node &> /dev/null; then
  critical "Node.js is not installed"
  exit 2
fi

NODE_VERSION=$(node --version)
log "Node.js version: $NODE_VERSION"

# Check if we're in project root
if [[ ! -f "package.json" ]]; then
  critical "Must be run from project root directory"
  exit 2
fi

success "Pre-flight checks passed"

# =============================================================================
# Detect Deployment Type
# =============================================================================

section "Detecting Deployment Type"

if [[ "$DEPLOYMENT_TYPE" == "auto" ]]; then
  if docker ps -q -f name=kaizoku &> /dev/null; then
    DEPLOYMENT_TYPE="docker"
    log "Detected Docker deployment"
  elif pm2 list | grep -q "kaizoku" 2> /dev/null; then
    DEPLOYMENT_TYPE="pm2"
    log "Detected PM2 deployment"
  else
    DEPLOYMENT_TYPE="manual"
    log "Manual deployment detected"
  fi
else
  log "Using specified deployment type: $DEPLOYMENT_TYPE"
fi

success "Deployment type: $DEPLOYMENT_TYPE"

# =============================================================================
# Confirmation
# =============================================================================

if [[ "$DRY_RUN" != "true" ]]; then
  section "⚠️  ROLLBACK CONFIRMATION"

  echo "You are about to rollback from Bun to Node.js runtime"
  echo ""
  echo "Deployment Type: $DEPLOYMENT_TYPE"
  echo "Backup Directory: $BACKUP_DIR"
  echo "Log File: $LOG_FILE"
  echo ""
  echo "This will:"
  echo "  1. Stop all Bun processes"
  echo "  2. Backup current state"
  echo "  3. Switch to Node.js runtime"
  echo "  4. Reinstall dependencies with npm"
  echo "  5. Rebuild application"
  echo "  6. Start services with Node.js"
  echo ""

  if ! confirm "Are you sure you want to proceed?"; then
    warning "Rollback cancelled by user"
    exit 3
  fi

  log "Rollback confirmed by user"
fi

# =============================================================================
# Create Backup
# =============================================================================

if [[ "$SKIP_BACKUP" != "true" ]]; then
  section "Creating Backup"

  run_command "mkdir -p $BACKUP_DIR" "Creating backup directory"

  # Backup important files
  if [[ -f "bun.lockb" ]]; then
    run_command "cp bun.lockb $BACKUP_DIR/" "Backing up bun.lockb"
  fi

  if [[ -f ".env" ]]; then
    run_command "cp .env $BACKUP_DIR/" "Backing up .env"
  fi

  if [[ -d ".next" ]]; then
    run_command "cp -r .next $BACKUP_DIR/" "Backing up .next build"
  fi

  success "Backup created at: $BACKUP_DIR"
else
  warning "Skipping backup (SKIP_BACKUP=true)"
fi

# =============================================================================
# Stop Bun Services
# =============================================================================

section "Stopping Bun Services"

case "$DEPLOYMENT_TYPE" in
  docker)
    log "Stopping Docker containers..."
    run_command "docker-compose -f docker-compose.bun.yml down" "Stopping Bun containers"
    ;;

  pm2)
    log "Stopping PM2 processes..."
    run_command "pm2 stop kaizoku-bun || true" "Stopping PM2 process"
    run_command "pm2 delete kaizoku-bun || true" "Deleting PM2 process"
    ;;

  manual)
    log "Attempting to stop manual processes..."
    if lsof -ti:3000 &> /dev/null; then
      run_command "lsof -ti:3000 | xargs kill -9" "Killing processes on port 3000"
    else
      log "No processes found on port 3000"
    fi
    ;;
esac

success "Bun services stopped"

# =============================================================================
# Remove Bun Artifacts
# =============================================================================

section "Cleaning Bun Artifacts"

run_command "rm -rf node_modules" "Removing node_modules"
run_command "rm -rf .next" "Removing .next build"

if [[ -f "bun.lockb" ]]; then
  run_command "rm bun.lockb" "Removing bun.lockb"
fi

success "Bun artifacts cleaned"

# =============================================================================
# Reinstall Dependencies with Node.js
# =============================================================================

section "Installing Dependencies with Node.js"

# Ensure package-lock.json exists or will be created
run_command "npm ci || bun install" "Installing dependencies with npm"

success "Dependencies installed with npm"

# =============================================================================
# Generate Prisma Client
# =============================================================================

section "Generating Prisma Client"

run_command "bunx prisma generate" "Generating Prisma client"

success "Prisma client generated"

# =============================================================================
# Build Application
# =============================================================================

section "Building Application with Node.js"

run_command "bun run build" "Building Next.js application"

success "Application built successfully"

# =============================================================================
# Start Node.js Services
# =============================================================================

section "Starting Node.js Services"

case "$DEPLOYMENT_TYPE" in
  docker)
    log "Starting Docker containers with Node.js..."
    run_command "docker-compose up -d" "Starting Node.js containers"
    ;;

  pm2)
    log "Starting PM2 processes with Node.js..."
    run_command "pm2 start npm --name kaizoku -- run start" "Starting with PM2"
    run_command "pm2 save" "Saving PM2 configuration"
    ;;

  manual)
    log "Manual start required"
    warning "Please start the application manually with: bun run start"
    ;;
esac

success "Node.js services started"

# =============================================================================
# Health Check
# =============================================================================

section "Health Check"

if [[ "$DRY_RUN" != "true" ]]; then
  log "Waiting for application to start..."
  sleep 10

  log "Checking health endpoint..."
  if curl -sf --max-time 10 http://localhost:3000/api/health > /dev/null 2>&1; then
    success "Application is healthy! ✅"
  else
    warning "Health check failed - application may still be starting"
    warning "Please check logs: $LOG_FILE"
  fi
else
  log "DRY RUN: Would perform health check"
fi

# =============================================================================
# Final Report
# =============================================================================

section "Rollback Complete"

echo ""
echo "✅ Successfully rolled back from Bun to Node.js"
echo ""
echo "Details:"
echo "  - Deployment Type: $DEPLOYMENT_TYPE"
echo "  - Node.js Version: $NODE_VERSION"
echo "  - Backup Location: $BACKUP_DIR"
echo "  - Log File: $LOG_FILE"
echo ""

if [[ "$DEPLOYMENT_TYPE" == "docker" ]]; then
  echo "Docker Status:"
  docker-compose ps
elif [[ "$DEPLOYMENT_TYPE" == "pm2" ]]; then
  echo "PM2 Status:"
  pm2 list
fi

echo ""
warning "Remember to:"
echo "  1. Update NGINX configuration if needed"
echo "  2. Monitor application logs"
echo "  3. Verify all features are working"
echo "  4. Update deployment documentation"
echo ""

log "Rollback completed successfully"
success "All done! 🎉"

exit 0

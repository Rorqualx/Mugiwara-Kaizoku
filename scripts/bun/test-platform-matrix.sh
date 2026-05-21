#!/usr/bin/env bash

# ============================================================================
# Local Platform Matrix Testing Script
# ============================================================================
# Tests the application across all installed package managers locally.
# Simulates CI matrix testing on your local machine to catch issues early.
#
# This script:
# - Detects available package managers (pnpm, npm, yarn, bun)
# - Tests installation, build, and compatibility with each
# - Generates detailed reports for each test
# - Validates SWC binary compatibility
#
# Usage:
#   ./scripts/bun/test-platform-matrix.sh [OPTIONS]
#
# Options:
#   --pm <name>     Test only specified package manager (pnpm|npm|yarn|bun)
#   --skip-build    Skip build step (faster, less thorough)
#   --verbose       Show detailed output
#   --clean         Remove node_modules between tests
#
# Exit Codes:
#   0 - All tests passed
#   1 - One or more tests failed
#
# Author: Development Team
# Status: Active
# ============================================================================

set -eo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SPECIFIC_PM=""
SKIP_BUILD=false
VERBOSE=false
CLEAN=false

# Script paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLATFORM_DETECT="$SCRIPT_DIR/platform-detect.sh"
FIX_SWC="$SCRIPT_DIR/fix-swc-binaries.sh"

# Test results
declare -A TEST_RESULTS
declare -A TEST_DURATIONS
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# Utility Functions
# ============================================================================

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_debug() { if [ "$VERBOSE" = true ]; then echo -e "${CYAN}🔍 $1${NC}"; fi; }

# ============================================================================
# Detect Available Package Managers
# ============================================================================

detect_package_managers() {
  log_info "Detecting available package managers..."

  local pms=()

  if command -v pnpm >/dev/null 2>&1; then
    pms+=("pnpm")
    log_success "pnpm $(pnpm --version) available"
  fi

  if command -v npm >/dev/null 2>&1; then
    pms+=("npm")
    log_success "npm $(npm --version) available"
  fi

  if command -v yarn >/dev/null 2>&1; then
    pms+=("yarn")
    log_success "yarn $(yarn --version) available"
  fi

  if command -v bun >/dev/null 2>&1 || [ -x "$HOME/.bun/bin/bun" ]; then
    pms+=("bun")
    local bun_cmd="${HOME}/.bun/bin/bun"
    if command -v bun >/dev/null 2>&1; then bun_cmd="bun"; fi
    log_success "bun $($bun_cmd --version) available"
  fi

  if [ ${#pms[@]} -eq 0 ]; then
    log_error "No package managers found"
    log_info "Install at least one: pnpm, npm, yarn, or bun"
    exit 1
  fi

  echo "${pms[@]}"
}

# ============================================================================
# Test Single Package Manager
# ============================================================================

test_package_manager() {
  local pm=$1
  local start_time=$(date +%s)

  log_info "=========================================="
  log_info "Testing with: $pm"
  log_info "=========================================="

  cd "$PROJECT_ROOT" || return 1

  # Clean if requested
  if [ "$CLEAN" = true ]; then
    log_info "Cleaning previous installation..."
    rm -rf node_modules .next
    rm -f bun.lockb pnpm-lock.yaml package-lock.json yarn.lock
  fi

  # Step 1: Install dependencies
  log_info "Installing dependencies with $pm..."
  case "$pm" in
    pnpm)
      if ! bun install 2>&1 | tee "test-$pm-install.log"; then
        log_error "$pm install failed"
        TEST_RESULTS[$pm]="FAILED (install)"
        return 1
      fi
      ;;
    npm)
      if ! bun install 2>&1 | tee "test-$pm-install.log"; then
        log_error "$pm install failed"
        TEST_RESULTS[$pm]="FAILED (install)"
        return 1
      fi
      ;;
    yarn)
      if ! yarn install 2>&1 | tee "test-$pm-install.log"; then
        log_error "$pm install failed"
        TEST_RESULTS[$pm]="FAILED (install)"
        return 1
      fi
      ;;
    bun)
      if ! bun install 2>&1 | tee "test-$pm-install.log"; then
        log_error "$pm install failed"
        TEST_RESULTS[$pm]="FAILED (install)"
        return 1
      fi
      ;;
  esac
  log_success "Dependencies installed"

  # Step 2: Run platform detection
  log_info "Running platform detection..."
  if ! "$PLATFORM_DETECT" --verbose > "test-$pm-platform.log" 2>&1; then
    log_warning "Platform detection reported issues"
  fi

  # Step 3: Check and fix SWC binaries
  log_info "Checking SWC binaries..."
  if ! "$FIX_SWC" --verbose > "test-$pm-swc.log" 2>&1; then
    log_error "SWC binary issues could not be fixed"
    TEST_RESULTS[$pm]="FAILED (swc)"
    return 1
  fi
  log_success "SWC binaries validated"

  # Step 4: Generate Prisma client
  log_info "Generating Prisma client..."
  case "$pm" in
    pnpm) bunx prisma generate ;;
    npm) bunx prisma generate ;;
    yarn) yarn prisma generate ;;
    bun) bun prisma generate ;;
  esac

  # Step 5: Type check
  log_info "Running type check..."
  case "$pm" in
    pnpm) bun run type-check ;;
    npm) bun run type-check ;;
    yarn) yarn type-check ;;
    bun) bun run type-check ;;
  esac > "test-$pm-typecheck.log" 2>&1 || {
    log_warning "Type check failed (non-blocking)"
  }

  # Step 6: Build (optional)
  if [ "$SKIP_BUILD" = false ]; then
    log_info "Building application..."
    case "$pm" in
      pnpm)
        if ! bun run build 2>&1 | tee "test-$pm-build.log"; then
          log_error "Build failed"
          TEST_RESULTS[$pm]="FAILED (build)"
          return 1
        fi
        ;;
      npm)
        if ! bun run build 2>&1 | tee "test-$pm-build.log"; then
          log_error "Build failed"
          TEST_RESULTS[$pm]="FAILED (build)"
          return 1
        fi
        ;;
      yarn)
        if ! yarn build 2>&1 | tee "test-$pm-build.log"; then
          log_error "Build failed"
          TEST_RESULTS[$pm]="FAILED (build)"
          return 1
        fi
        ;;
      bun)
        if ! bun run build 2>&1 | tee "test-$pm-build.log"; then
          log_error "Build failed"
          TEST_RESULTS[$pm]="FAILED (build)"
          return 1
        fi
        ;;
    esac
    log_success "Build completed"

    # Verify build artifacts
    if [ ! -d ".next/standalone" ]; then
      log_error "Standalone build not found"
      TEST_RESULTS[$pm]="FAILED (artifacts)"
      return 1
    fi
  fi

  # Calculate duration
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  TEST_DURATIONS[$pm]=$duration

  # Success
  TEST_RESULTS[$pm]="PASSED"
  log_success "$pm test completed in ${duration}s"
  return 0
}

# ============================================================================
# Generate Report
# ============================================================================

generate_report() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║       Local Platform Matrix Test Results                      ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Platform info
  log_info "Platform Information:"
  "$PLATFORM_DETECT" 2>/dev/null | head -20

  echo ""
  log_info "Test Results:"
  echo ""

  # Print results table
  printf "%-15s %-15s %-15s\n" "Package Manager" "Result" "Duration"
  printf "%-15s %-15s %-15s\n" "---------------" "------" "--------"

  for pm in "${!TEST_RESULTS[@]}"; do
    local result="${TEST_RESULTS[$pm]}"
    local duration="${TEST_DURATIONS[$pm]:-0}"

    if [[ "$result" == "PASSED" ]]; then
      printf "%-15s ${GREEN}%-15s${NC} %-15s\n" "$pm" "$result" "${duration}s"
    else
      printf "%-15s ${RED}%-15s${NC} %-15s\n" "$pm" "$result" "${duration}s"
    fi
  done

  echo ""
  echo "Summary:"
  echo "  Tests Run:    $TESTS_RUN"
  echo "  Passed:       $TESTS_PASSED"
  echo "  Failed:       $TESTS_FAILED"
  echo ""

  if [ $TESTS_FAILED -eq 0 ]; then
    log_success "All tests passed! ✨"
  else
    log_error "$TESTS_FAILED test(s) failed"
    echo ""
    echo "Review log files for details:"
    ls test-*.log 2>/dev/null | while read log; do
      echo "  - $log"
    done
  fi
  echo ""
}

# ============================================================================
# Main
# ============================================================================

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --pm)
        SPECIFIC_PM=$2
        shift 2
        ;;
      --skip-build)
        SKIP_BUILD=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      --clean)
        CLEAN=true
        shift
        ;;
      -h|--help)
        cat <<EOF
Usage: $0 [OPTIONS]

Test application across all available package managers.

Options:
  --pm <name>     Test only specified package manager (pnpm|npm|yarn|bun)
  --skip-build    Skip build step (faster testing)
  --verbose       Show detailed output
  --clean         Remove node_modules between tests
  -h, --help      Show this help

Examples:
  # Test all package managers
  $0

  # Test only pnpm
  $0 --pm pnpm

  # Quick test without build
  $0 --skip-build

  # Clean test with all package managers
  $0 --clean --verbose

EOF
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        exit 1
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  cd "$PROJECT_ROOT" || exit 1

  # Detect available package managers
  local available_pms
  if [ -n "$SPECIFIC_PM" ]; then
    available_pms=("$SPECIFIC_PM")
    log_info "Testing specific package manager: $SPECIFIC_PM"
  else
    IFS=' ' read -r -a available_pms <<< "$(detect_package_managers)"
  fi

  # Run tests
  for pm in "${available_pms[@]}"; do
    ((TESTS_RUN++))
    if test_package_manager "$pm"; then
      ((TESTS_PASSED++))
    else
      ((TESTS_FAILED++))
    fi
    echo ""
  done

  # Generate report
  generate_report

  # Exit with appropriate code
  if [ $TESTS_FAILED -eq 0 ]; then
    exit 0
  else
    exit 1
  fi
}

main "$@"

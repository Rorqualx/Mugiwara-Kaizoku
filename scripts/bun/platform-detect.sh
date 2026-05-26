#!/usr/bin/env bash

# ============================================================================
# Bun Platform Detection Script
# ============================================================================
# Detects OS, architecture, Bun installation, package manager, and required
# Next.js SWC binaries for platform compatibility validation.
#
# Usage:
#   ./scripts/bun/platform-detect.sh [--json] [--verbose] [--no-fail]
#
# Options:
#   --json      Output results in JSON format
#   --verbose   Show detailed detection information
#   --no-fail   Always exit 0 if OS/arch detected (bun-missing is advisory)
#
# Exit Codes:
#   0 - Detection successful
#   1 - Bun not found
#   2 - Unsupported platform
#   3 - Detection failed
#
# Author: Development Team
# Status: Active
# ============================================================================

set -eo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Command line flags
JSON_OUTPUT=false
VERBOSE=false
# When true, always exit 0 if the platform was detected — bun-missing /
# swc-missing become advisory (still reported in JSON). The CI test-platform
# matrix runs this script on non-bun variants where exit 1 is incorrect.
NO_FAIL=false

# Detection results
OS=""
OS_VERSION=""
ARCH=""
BUN_INSTALLED=false
BUN_VERSION=""
BUN_ARCH=""
NODE_INSTALLED=false
NODE_VERSION=""
PACKAGE_MANAGER=""
PACKAGE_MANAGER_VERSION=""
NEXT_VERSION=""
REQUIRED_SWC_BINARY=""
SWC_BINARY_EXISTS=false
IS_ROSETTA=false
IS_DOCKER=false
IS_CI=false

# ============================================================================
# Utility Functions
# ============================================================================

log_info() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${BLUE}ℹ️  $1${NC}" >&2
  fi
}

log_success() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${GREEN}✅ $1${NC}" >&2
  fi
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}" >&2
}

log_error() {
  echo -e "${RED}❌ $1${NC}" >&2
}

# ============================================================================
# Operating System Detection
# ============================================================================

detect_os() {
  log_info "Detecting operating system..."

  case "$(uname -s)" in
    Darwin*)
      OS="darwin"
      OS_VERSION=$(sw_vers -productVersion)
      log_success "Detected macOS $OS_VERSION"
      ;;
    Linux*)
      OS="linux"
      if [ -f /etc/os-release ]; then
        OS_VERSION=$(grep '^VERSION=' /etc/os-release | cut -d'"' -f2)
        DISTRO=$(grep '^ID=' /etc/os-release | cut -d'=' -f2)
        log_success "Detected Linux ($DISTRO) $OS_VERSION"
      else
        OS_VERSION="unknown"
        log_warning "Linux version could not be determined"
      fi
      ;;
    CYGWIN*|MINGW*|MSYS*)
      OS="win32"
      OS_VERSION=$(wmic os get Version /value | grep -oP '(?<=Version=).*')
      log_success "Detected Windows $OS_VERSION"
      ;;
    *)
      OS="unknown"
      log_error "Unsupported operating system: $(uname -s)"
      return 2
      ;;
  esac
}

# ============================================================================
# Architecture Detection
# ============================================================================

detect_architecture() {
  log_info "Detecting system architecture..."

  local machine_arch=$(uname -m)

  case "$machine_arch" in
    x86_64|amd64)
      ARCH="x64"
      log_success "Detected x86_64 architecture"
      ;;
    arm64|aarch64)
      ARCH="arm64"
      log_success "Detected ARM64 architecture"
      ;;
    armv7l)
      ARCH="armv7"
      log_success "Detected ARMv7 architecture"
      ;;
    i386|i686)
      ARCH="ia32"
      log_warning "Detected 32-bit x86 (not recommended)"
      ;;
    *)
      ARCH="unknown"
      log_error "Unsupported architecture: $machine_arch"
      return 2
      ;;
  esac

  # Check for Rosetta 2 on macOS
  if [ "$OS" = "darwin" ]; then
    if [ "$ARCH" = "x64" ] && [ -f /usr/sbin/sysctl ]; then
      local is_translated=$(/usr/sbin/sysctl -n sysctl.proc_translated 2>/dev/null || echo "0")
      if [ "$is_translated" = "1" ]; then
        IS_ROSETTA=true
        log_warning "Running under Rosetta 2 (ARM Mac emulating x86_64)"
      fi
    fi
  fi
}

# ============================================================================
# Bun Detection
# ============================================================================

detect_bun() {
  log_info "Detecting Bun runtime..."

  # Check common Bun installation paths
  local bun_paths=(
    "$HOME/.bun/bin/bun"
    "/usr/local/bin/bun"
    "$(which bun 2>/dev/null || echo '')"
  )

  for bun_path in "${bun_paths[@]}"; do
    if [ -n "$bun_path" ] && [ -x "$bun_path" ]; then
      BUN_INSTALLED=true
      BUN_VERSION=$("$bun_path" --version 2>/dev/null || echo "unknown")

      # Detect Bun's architecture
      if [ "$OS" = "darwin" ]; then
        BUN_ARCH=$(file -b "$bun_path" | grep -o 'arm64\|x86_64' || echo "unknown")
        if [ "$BUN_ARCH" = "x86_64" ]; then
          BUN_ARCH="x64"
        fi
      elif [ "$OS" = "linux" ]; then
        BUN_ARCH=$(file -b "$bun_path" | grep -o 'aarch64\|x86-64' || echo "unknown")
        if [ "$BUN_ARCH" = "aarch64" ]; then
          BUN_ARCH="arm64"
        elif [ "$BUN_ARCH" = "x86-64" ]; then
          BUN_ARCH="x64"
        fi
      else
        BUN_ARCH="$ARCH"
      fi

      log_success "Bun v$BUN_VERSION detected ($BUN_ARCH)"

      # Check for architecture mismatch
      if [ "$ARCH" != "$BUN_ARCH" ] && [ "$IS_ROSETTA" = false ]; then
        log_warning "Architecture mismatch: System=$ARCH, Bun=$BUN_ARCH"
      fi

      return 0
    fi
  done

  log_warning "Bun runtime not found"
  BUN_INSTALLED=false
  return 1
}

# ============================================================================
# Node.js Detection
# ============================================================================

detect_node() {
  log_info "Detecting Node.js runtime..."

  if command -v node >/dev/null 2>&1; then
    NODE_INSTALLED=true
    NODE_VERSION=$(node --version | sed 's/v//')
    log_success "Node.js v$NODE_VERSION detected"
  else
    log_info "Node.js not found (optional)"
    NODE_INSTALLED=false
  fi
}

# ============================================================================
# Package Manager Detection
# ============================================================================

detect_package_manager() {
  log_info "Detecting package manager..."

  # Check for lockfiles first (most reliable)
  if [ -f "bun.lockb" ]; then
    PACKAGE_MANAGER="bun"
    if command -v bun >/dev/null 2>&1; then
      PACKAGE_MANAGER_VERSION=$(bun --version)
    fi
    log_success "Package manager: Bun (detected via bun.lockb)"
  elif [ -f "pnpm-lock.yaml" ]; then
    PACKAGE_MANAGER="pnpm"
    if command -v pnpm >/dev/null 2>&1; then
      PACKAGE_MANAGER_VERSION=$(pnpm --version)
    fi
    log_success "Package manager: pnpm (detected via pnpm-lock.yaml)"
  elif [ -f "yarn.lock" ]; then
    PACKAGE_MANAGER="yarn"
    if command -v yarn >/dev/null 2>&1; then
      PACKAGE_MANAGER_VERSION=$(yarn --version)
    fi
    log_success "Package manager: Yarn (detected via yarn.lock)"
  elif [ -f "package-lock.json" ]; then
    PACKAGE_MANAGER="npm"
    if command -v npm >/dev/null 2>&1; then
      PACKAGE_MANAGER_VERSION=$(npm --version)
    fi
    log_success "Package manager: npm (detected via package-lock.json)"
  else
    PACKAGE_MANAGER="unknown"
    log_warning "No lockfile found - package manager unknown"
  fi
}

# ============================================================================
# Next.js SWC Binary Detection
# ============================================================================

detect_nextjs_swc() {
  log_info "Detecting required Next.js SWC binary..."

  # Get Next.js version from package.json
  if [ -f "package.json" ]; then
    NEXT_VERSION=$(node -p "require('./package.json').dependencies.next || ''" 2>/dev/null || echo "")
    if [ -n "$NEXT_VERSION" ]; then
      log_info "Next.js version: $NEXT_VERSION"
    fi
  fi

  # Determine required SWC binary based on OS and architecture
  # Use Bun's architecture if Bun is installed, otherwise use system architecture
  local target_arch="${BUN_ARCH:-$ARCH}"

  case "$OS-$target_arch" in
    darwin-arm64)
      REQUIRED_SWC_BINARY="@next/swc-darwin-arm64"
      ;;
    darwin-x64)
      REQUIRED_SWC_BINARY="@next/swc-darwin-x64"
      ;;
    linux-arm64)
      REQUIRED_SWC_BINARY="@next/swc-linux-arm64-gnu"
      ;;
    linux-x64)
      REQUIRED_SWC_BINARY="@next/swc-linux-x64-gnu"
      ;;
    win32-x64)
      REQUIRED_SWC_BINARY="@next/swc-win32-x64-msvc"
      ;;
    win32-arm64)
      REQUIRED_SWC_BINARY="@next/swc-win32-arm64-msvc"
      ;;
    *)
      REQUIRED_SWC_BINARY="unknown"
      log_warning "Cannot determine required SWC binary for $OS-$target_arch"
      return 0
      ;;
  esac

  log_success "Required SWC binary: $REQUIRED_SWC_BINARY"

  # Check if SWC binary exists
  check_swc_binary_exists
}

check_swc_binary_exists() {
  if [ "$REQUIRED_SWC_BINARY" = "unknown" ]; then
    return 0
  fi

  local swc_paths=(
    "node_modules/$REQUIRED_SWC_BINARY"
    "node_modules/.pnpm/$REQUIRED_SWC_BINARY@*/node_modules/$REQUIRED_SWC_BINARY"
  )

  for swc_path in "${swc_paths[@]}"; do
    if [ -e $swc_path ] || compgen -G "$swc_path" > /dev/null 2>&1; then
      SWC_BINARY_EXISTS=true
      log_success "SWC binary found: $swc_path"
      return 0
    fi
  done

  log_warning "SWC binary not found in node_modules"
  SWC_BINARY_EXISTS=false
}

# ============================================================================
# Environment Detection
# ============================================================================

detect_environment() {
  log_info "Detecting environment context..."

  # Check if running in Docker
  if [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    IS_DOCKER=true
    log_info "Running in Docker container"
  fi

  # Check if running in CI
  if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || [ -n "${GITLAB_CI:-}" ]; then
    IS_CI=true
    log_info "Running in CI environment"
  fi
}

# ============================================================================
# Output Functions
# ============================================================================

# Strip any control characters (U+0000..U+001F) and double-quote / backslash
# escape a value so it can be safely embedded inside a JSON string. Detection
# helpers shell out to commands (`file -b`, `bun --version`, `node -p`) whose
# output occasionally includes stray control bytes (CR, ESC color codes) on
# certain CI runners — without this, `jq` rejects the emitted file with
# "Invalid string: control characters from U+0000 through U+001F".
json_escape() {
  printf '%s' "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

output_json() {
  cat <<EOF
{
  "os": "$(json_escape "$OS")",
  "osVersion": "$(json_escape "$OS_VERSION")",
  "arch": "$(json_escape "$ARCH")",
  "bunInstalled": $BUN_INSTALLED,
  "bunVersion": "$(json_escape "$BUN_VERSION")",
  "bunArch": "$(json_escape "$BUN_ARCH")",
  "nodeInstalled": $NODE_INSTALLED,
  "nodeVersion": "$(json_escape "$NODE_VERSION")",
  "packageManager": "$(json_escape "$PACKAGE_MANAGER")",
  "packageManagerVersion": "$(json_escape "$PACKAGE_MANAGER_VERSION")",
  "nextVersion": "$(json_escape "$NEXT_VERSION")",
  "requiredSwcBinary": "$(json_escape "$REQUIRED_SWC_BINARY")",
  "swcBinaryExists": $SWC_BINARY_EXISTS,
  "isRosetta": $IS_ROSETTA,
  "isDocker": $IS_DOCKER,
  "isCI": $IS_CI
}
EOF
}

output_human() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║            Bun Platform Detection Report                      ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${GREEN}Operating System:${NC}"
  echo "  OS:           $OS"
  echo "  Version:      $OS_VERSION"
  echo "  Architecture: $ARCH"
  if [ "$IS_ROSETTA" = true ]; then
    echo -e "  ${YELLOW}Rosetta:      Active (ARM Mac emulating x86_64)${NC}"
  fi
  echo ""

  echo -e "${GREEN}Runtimes:${NC}"
  if [ "$BUN_INSTALLED" = true ]; then
    echo -e "  Bun:          ${GREEN}✓${NC} v$BUN_VERSION ($BUN_ARCH)"
    if [ "$ARCH" != "$BUN_ARCH" ] && [ "$IS_ROSETTA" = false ]; then
      echo -e "                ${YELLOW}⚠️  Architecture mismatch: System=$ARCH, Bun=$BUN_ARCH${NC}"
    fi
  else
    echo -e "  Bun:          ${RED}✗${NC} Not installed"
  fi

  if [ "$NODE_INSTALLED" = true ]; then
    echo -e "  Node.js:      ${GREEN}✓${NC} v$NODE_VERSION"
  else
    echo -e "  Node.js:      ${YELLOW}✗${NC} Not installed (optional)"
  fi
  echo ""

  echo -e "${GREEN}Package Manager:${NC}"
  if [ "$PACKAGE_MANAGER" != "unknown" ]; then
    echo "  Type:         $PACKAGE_MANAGER"
    if [ -n "$PACKAGE_MANAGER_VERSION" ]; then
      echo "  Version:      $PACKAGE_MANAGER_VERSION"
    fi
  else
    echo -e "  Type:         ${YELLOW}Unknown (no lockfile found)${NC}"
  fi
  echo ""

  echo -e "${GREEN}Next.js SWC:${NC}"
  if [ -n "$NEXT_VERSION" ]; then
    echo "  Next.js:      $NEXT_VERSION"
  fi
  if [ "$REQUIRED_SWC_BINARY" != "unknown" ]; then
    echo "  Required:     $REQUIRED_SWC_BINARY"
    if [ "$SWC_BINARY_EXISTS" = true ]; then
      echo -e "  Status:       ${GREEN}✓${NC} Binary found"
    else
      echo -e "  Status:       ${RED}✗${NC} Binary missing"
    fi
  else
    echo -e "  Required:     ${YELLOW}Cannot determine${NC}"
  fi
  echo ""

  echo -e "${GREEN}Environment:${NC}"
  echo "  Docker:       $([ "$IS_DOCKER" = true ] && echo "Yes" || echo "No")"
  echo "  CI:           $([ "$IS_CI" = true ] && echo "Yes" || echo "No")"
  echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --json)
        JSON_OUTPUT=true
        shift
        ;;
      --no-fail)
        NO_FAIL=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      -h|--help)
        cat <<EOF
Usage: $0 [OPTIONS]

Detect platform configuration for Bun compatibility validation.

Options:
  --json      Output results in JSON format
  --verbose   Show detailed detection information
  --no-fail   Always exit 0 if OS/arch detected (bun-missing is advisory)
  -h, --help  Show this help message

Exit Codes:
  0 - Detection successful
  1 - Bun not found
  2 - Unsupported platform
  3 - Detection failed

EOF
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        exit 3
        ;;
    esac
  done
}

main() {
  parse_args "$@"

  # Run all detection functions
  detect_os || exit $?
  detect_architecture || exit $?
  detect_bun || true  # Don't fail if Bun not found
  detect_node || true  # Don't fail if Node not found
  detect_package_manager
  detect_nextjs_swc
  detect_environment

  # Output results
  if [ "$JSON_OUTPUT" = true ]; then
    output_json
  else
    output_human
  fi

  # Exit with appropriate code. `--no-fail` collapses bun-missing into a
  # success so reporting-only callers (CI matrix on non-bun variants) don't
  # die just because Bun isn't installed.
  if [ "$OS" = "unknown" ] || [ "$ARCH" = "unknown" ]; then
    exit 2
  elif [ "$BUN_INSTALLED" = false ] && [ "$NO_FAIL" = false ]; then
    exit 1
  else
    exit 0
  fi
}

main "$@"

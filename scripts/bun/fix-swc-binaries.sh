#!/usr/bin/env bash

# ============================================================================
# Bun + Next.js SWC Binary Auto-Fix Script
# ============================================================================
# Automatically fixes broken or missing Next.js SWC binaries across different
# package managers (pnpm, npm, yarn, bun) and architectures.
#
# This script addresses the common issue where:
# - Next.js cannot find the correct SWC binary for the platform
# - Package managers create virtual stores or hoisted structures
# - Bun architecture differs from system architecture (e.g., ARM Bun on Rosetta)
# - Symlinks point to non-existent locations
#
# Usage:
#   ./scripts/bun/fix-swc-binaries.sh [--dry-run] [--verbose] [--force]
#
# Options:
#   --dry-run   Show what would be fixed without making changes
#   --verbose   Show detailed debugging information
#   --force     Force reinstallation of SWC binaries
#
# Exit Codes:
#   0 - No issues found or all issues fixed
#   1 - SWC binaries missing and cannot be fixed
#   2 - Package manager not detected
#   3 - Unsupported platform
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
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Command line flags
DRY_RUN=false
VERBOSE=false
FORCE=false

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Detection results (populated by platform-detect.sh)
OS=""
ARCH=""
BUN_ARCH=""
PACKAGE_MANAGER=""
REQUIRED_SWC_BINARY=""
SWC_BINARY_EXISTS=false

# Fix tracking
ISSUES_FOUND=0
ISSUES_FIXED=0

# ============================================================================
# Utility Functions
# ============================================================================

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_debug() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${CYAN}🔍 $1${NC}" >&2
  fi
}

log_dry_run() {
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN] $1${NC}"
  fi
}

# ============================================================================
# Platform Detection
# ============================================================================

detect_platform() {
  log_info "Detecting platform configuration..."

  cd "$PROJECT_ROOT" || exit 3

  # Run platform detection script
  if [ ! -f "$SCRIPT_DIR/platform-detect.sh" ]; then
    log_error "Platform detection script not found: $SCRIPT_DIR/platform-detect.sh"
    exit 3
  fi

  local detection_output=$("$SCRIPT_DIR/platform-detect.sh" --json 2>/dev/null || echo "{}")

  # Parse JSON output
  OS=$(echo "$detection_output" | grep -o '"os":"[^"]*"' | cut -d'"' -f4)
  ARCH=$(echo "$detection_output" | grep -o '"arch":"[^"]*"' | cut -d'"' -f4)
  BUN_ARCH=$(echo "$detection_output" | grep -o '"bunArch":"[^"]*"' | cut -d'"' -f4)
  PACKAGE_MANAGER=$(echo "$detection_output" | grep -o '"packageManager":"[^"]*"' | cut -d'"' -f4)
  REQUIRED_SWC_BINARY=$(echo "$detection_output" | grep -o '"requiredSwcBinary":"[^"]*"' | cut -d'"' -f4)
  SWC_BINARY_EXISTS=$(echo "$detection_output" | grep -o '"swcBinaryExists":[^,}]*' | cut -d':' -f2)

  log_debug "Platform: $OS-$ARCH"
  log_debug "Bun architecture: $BUN_ARCH"
  log_debug "Package manager: $PACKAGE_MANAGER"
  log_debug "Required SWC binary: $REQUIRED_SWC_BINARY"
  log_debug "SWC binary exists: $SWC_BINARY_EXISTS"

  # Validate detection
  if [ -z "$OS" ] || [ "$OS" = "unknown" ]; then
    log_error "Could not detect operating system"
    exit 3
  fi

  if [ -z "$PACKAGE_MANAGER" ] || [ "$PACKAGE_MANAGER" = "unknown" ]; then
    log_error "Could not detect package manager (no lockfile found)"
    exit 2
  fi

  if [ -z "$REQUIRED_SWC_BINARY" ] || [ "$REQUIRED_SWC_BINARY" = "unknown" ]; then
    log_error "Could not determine required SWC binary for platform"
    exit 3
  fi

  log_success "Platform detected: $OS-$ARCH ($PACKAGE_MANAGER)"
}

# ============================================================================
# SWC Binary Validation
# ============================================================================

validate_swc_binary() {
  log_info "Validating SWC binary installation..."

  local swc_package_dir="$PROJECT_ROOT/node_modules/$REQUIRED_SWC_BINARY"

  # Check if package directory exists
  if [ ! -d "$swc_package_dir" ]; then
    log_warning "SWC binary package directory not found: $swc_package_dir"
    ((ISSUES_FOUND++))
    return 1
  fi

  # Check for binary files (different per platform)
  local binary_found=false
  case "$OS" in
    darwin|linux)
      if [ -f "$swc_package_dir/swc.node" ] || [ -f "$swc_package_dir/next-swc.node" ]; then
        binary_found=true
      fi
      ;;
    win32)
      if [ -f "$swc_package_dir/swc.node" ] || [ -f "$swc_package_dir/next-swc.dll" ]; then
        binary_found=true
      fi
      ;;
  esac

  if [ "$binary_found" = false ]; then
    log_warning "SWC binary files not found in package directory"
    ((ISSUES_FOUND++))
    return 1
  fi

  log_success "SWC binary package is valid"
  return 0
}

# ============================================================================
# pnpm-Specific Fixes
# ============================================================================

fix_pnpm_swc_symlinks() {
  log_info "Checking pnpm virtual store symlinks..."

  # Find Next.js installation in pnpm virtual store
  local next_virtual_paths=$(find "$PROJECT_ROOT/node_modules/.pnpm" -maxdepth 1 -type d -name "next@*" 2>/dev/null || true)

  if [ -z "$next_virtual_paths" ]; then
    log_warning "Could not find Next.js in pnpm virtual store"
    ((ISSUES_FOUND++))
    return 1
  fi

  local fixed=0
  while IFS= read -r next_virtual_path; do
    log_debug "Checking: $next_virtual_path"

    local next_node_modules="$next_virtual_path/node_modules/@next"
    local swc_binary_name=$(basename "$REQUIRED_SWC_BINARY")
    local swc_symlink="$next_node_modules/$swc_binary_name"
    local swc_target="$PROJECT_ROOT/node_modules/$REQUIRED_SWC_BINARY"

    # Check if symlink exists
    if [ -L "$swc_symlink" ]; then
      # Check if symlink is broken
      if [ ! -e "$swc_symlink" ]; then
        log_warning "Found broken symlink: $swc_symlink"
        ((ISSUES_FOUND++))

        if [ "$DRY_RUN" = false ]; then
          log_info "Removing broken symlink..."
          rm "$swc_symlink"
        else
          log_dry_run "Would remove: $swc_symlink"
        fi
      else
        log_debug "Valid symlink found: $swc_symlink"
        continue
      fi
    elif [ -e "$swc_symlink" ]; then
      log_debug "SWC binary already exists (not a symlink): $swc_symlink"
      continue
    fi

    # Create symlink if target exists
    if [ -d "$swc_target" ]; then
      if [ "$DRY_RUN" = false ]; then
        # Ensure parent directory exists
        mkdir -p "$next_node_modules"

        # Create relative symlink
        local relative_path=$(realpath --relative-to="$next_node_modules" "$swc_target" 2>/dev/null || echo "../../../../$REQUIRED_SWC_BINARY")

        log_info "Creating symlink: $swc_symlink -> $relative_path"
        ln -s "$relative_path" "$swc_symlink"
        ((ISSUES_FIXED++))
        ((fixed++))
      else
        log_dry_run "Would create symlink: $swc_symlink -> $swc_target"
        ((fixed++))
      fi
    else
      log_warning "SWC binary target not found: $swc_target"
      ((ISSUES_FOUND++))
      return 1
    fi
  done <<< "$next_virtual_paths"

  if [ $fixed -gt 0 ]; then
    log_success "Fixed $fixed pnpm symlink(s)"
  else
    log_success "All pnpm symlinks are valid"
  fi

  return 0
}

# ============================================================================
# npm-Specific Fixes
# ============================================================================

fix_npm_swc_structure() {
  log_info "Checking bun installation structure..."

  local next_path="$PROJECT_ROOT/node_modules/next"
  local swc_binary_path="$PROJECT_ROOT/node_modules/$REQUIRED_SWC_BINARY"

  if [ ! -d "$next_path" ]; then
    log_warning "Next.js not found in node_modules"
    ((ISSUES_FOUND++))
    return 1
  fi

  if [ ! -d "$swc_binary_path" ]; then
    log_warning "SWC binary not found: $swc_binary_path"
    ((ISSUES_FOUND++))
    return 1
  fi

  # npm uses flat structure, so SWC binary should be in node_modules root
  # No additional fixes typically needed for npm
  log_success "bun installation structure is valid"
  return 0
}

# ============================================================================
# Yarn-Specific Fixes
# ============================================================================

fix_yarn_swc_hoisting() {
  log_info "Checking yarn hoisted installation..."

  local next_path="$PROJECT_ROOT/node_modules/next"
  local swc_binary_path="$PROJECT_ROOT/node_modules/$REQUIRED_SWC_BINARY"

  if [ ! -d "$next_path" ]; then
    log_warning "Next.js not found in node_modules"
    ((ISSUES_FOUND++))
    return 1
  fi

  if [ ! -d "$swc_binary_path" ]; then
    log_warning "SWC binary not found: $swc_binary_path"
    ((ISSUES_FOUND++))
    return 1
  fi

  # Check if Next.js can find SWC binary
  local next_swc_path="$next_path/node_modules/@next/$(basename "$REQUIRED_SWC_BINARY")"

  if [ -L "$next_swc_path" ] && [ ! -e "$next_swc_path" ]; then
    log_warning "Found broken symlink in Yarn installation: $next_swc_path"
    ((ISSUES_FOUND++))

    if [ "$DRY_RUN" = false ]; then
      rm "$next_swc_path"
      mkdir -p "$(dirname "$next_swc_path")"
      ln -s "$swc_binary_path" "$next_swc_path"
      log_success "Fixed Yarn symlink"
      ((ISSUES_FIXED++))
    else
      log_dry_run "Would fix Yarn symlink: $next_swc_path"
    fi
  else
    log_success "Yarn installation structure is valid"
  fi

  return 0
}

# ============================================================================
# Bun-Specific Fixes
# ============================================================================

fix_bun_swc_installation() {
  log_info "Checking Bun installation structure..."

  local next_path="$PROJECT_ROOT/node_modules/next"
  local swc_binary_path="$PROJECT_ROOT/node_modules/$REQUIRED_SWC_BINARY"

  if [ ! -d "$next_path" ]; then
    log_warning "Next.js not found in node_modules"
    ((ISSUES_FOUND++))
    return 1
  fi

  if [ ! -d "$swc_binary_path" ]; then
    log_warning "SWC binary not found: $swc_binary_path"
    ((ISSUES_FOUND++))
    return 1
  fi

  # Bun typically uses symlinks similar to pnpm
  # Check if symlinks are correct
  if [ -d "$PROJECT_ROOT/node_modules/.cache" ]; then
    log_debug "Bun cache directory found"
    # Bun handles this internally, usually no fixes needed
  fi

  log_success "Bun installation structure is valid"
  return 0
}

# ============================================================================
# SWC Binary Installation
# ============================================================================

install_swc_binary() {
  log_info "Installing SWC binary: $REQUIRED_SWC_BINARY"

  if [ "$DRY_RUN" = true ]; then
    log_dry_run "Would install: $REQUIRED_SWC_BINARY"
    return 0
  fi

  cd "$PROJECT_ROOT" || exit 3

  case "$PACKAGE_MANAGER" in
    pnpm)
      log_info "Installing with pnpm..."
      pnpm add -D "$REQUIRED_SWC_BINARY" || return 1
      ;;
    npm)
      log_info "Installing with npm..."
      bun install --save-dev "$REQUIRED_SWC_BINARY" || return 1
      ;;
    yarn)
      log_info "Installing with yarn..."
      yarn add -D "$REQUIRED_SWC_BINARY" || return 1
      ;;
    bun)
      log_info "Installing with bun..."
      bun add -d "$REQUIRED_SWC_BINARY" || return 1
      ;;
    *)
      log_error "Unsupported package manager: $PACKAGE_MANAGER"
      return 1
      ;;
  esac

  log_success "SWC binary installed successfully"
  ((ISSUES_FIXED++))
  return 0
}

# ============================================================================
# Main Fix Logic
# ============================================================================

fix_swc_binaries() {
  log_info "Starting SWC binary auto-fix..."

  # Step 1: Validate if SWC binary package exists
  if [ "$FORCE" = true ] || ! validate_swc_binary; then
    if [ "$FORCE" = true ]; then
      log_info "Force reinstall requested"
    fi
    install_swc_binary || {
      log_error "Failed to install SWC binary"
      return 1
    }
  fi

  # Step 2: Apply package-manager-specific fixes
  case "$PACKAGE_MANAGER" in
    pnpm)
      fix_pnpm_swc_symlinks || true
      ;;
    npm)
      fix_npm_swc_structure || true
      ;;
    yarn)
      fix_yarn_swc_hoisting || true
      ;;
    bun)
      fix_bun_swc_installation || true
      ;;
    *)
      log_error "Unsupported package manager: $PACKAGE_MANAGER"
      return 2
      ;;
  esac

  return 0
}

# ============================================================================
# Report Generation
# ============================================================================

generate_report() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║            SWC Binary Auto-Fix Report                         ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${GREEN}Platform:${NC}"
  echo "  OS:              $OS-$ARCH"
  echo "  Package Manager: $PACKAGE_MANAGER"
  echo "  Required Binary: $REQUIRED_SWC_BINARY"
  echo ""

  echo -e "${GREEN}Results:${NC}"
  if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "  Issues Found:    ${GREEN}0${NC} (No problems detected)"
  else
    echo -e "  Issues Found:    ${YELLOW}$ISSUES_FOUND${NC}"
  fi

  if [ "$DRY_RUN" = true ]; then
    echo -e "  Issues Fixed:    ${YELLOW}N/A (dry run mode)${NC}"
  elif [ $ISSUES_FIXED -eq 0 ] && [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "  Issues Fixed:    ${GREEN}0${NC} (No fixes needed)"
  elif [ $ISSUES_FIXED -gt 0 ]; then
    echo -e "  Issues Fixed:    ${GREEN}$ISSUES_FIXED${NC}"
  else
    echo -e "  Issues Fixed:    ${RED}0${NC} (Fixes failed)"
  fi
  echo ""

  if [ $ISSUES_FOUND -gt 0 ] && [ $ISSUES_FIXED -eq 0 ] && [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}⚠️  Some issues could not be automatically fixed.${NC}"
    echo -e "${YELLOW}   Try running with --force to reinstall SWC binaries.${NC}"
    echo ""
  elif [ "$DRY_RUN" = true ] && [ $ISSUES_FOUND -gt 0 ]; then
    echo -e "${YELLOW}ℹ️  Run without --dry-run to apply fixes.${NC}"
    echo ""
  elif [ $ISSUES_FIXED -gt 0 ]; then
    echo -e "${GREEN}✅ All issues have been resolved!${NC}"
    echo ""
  fi
}

# ============================================================================
# Argument Parsing
# ============================================================================

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      --force)
        FORCE=true
        shift
        ;;
      -h|--help)
        cat <<EOF
Usage: $0 [OPTIONS]

Automatically fix Next.js SWC binary issues across package managers.

Options:
  --dry-run   Show what would be fixed without making changes
  --verbose   Show detailed debugging information
  --force     Force reinstallation of SWC binaries
  -h, --help  Show this help message

Exit Codes:
  0 - No issues found or all issues fixed
  1 - SWC binaries missing and cannot be fixed
  2 - Package manager not detected
  3 - Unsupported platform

Examples:
  # Check for issues without fixing
  $0 --dry-run --verbose

  # Fix all issues
  $0

  # Force reinstall SWC binaries
  $0 --force

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

# ============================================================================
# Main Execution
# ============================================================================

main() {
  parse_args "$@"

  # Detect platform
  detect_platform

  # Fix SWC binaries
  fix_swc_binaries
  local fix_result=$?

  # Generate report
  generate_report

  # Exit with appropriate code
  if [ $ISSUES_FOUND -eq 0 ] || [ $ISSUES_FIXED -gt 0 ]; then
    exit 0
  else
    exit $fix_result
  fi
}

main "$@"

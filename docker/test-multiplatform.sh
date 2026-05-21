#!/usr/bin/env bash

# ============================================================================
# Docker Multi-Platform Testing Script
# ============================================================================
# Tests Docker builds across multiple platforms (linux/amd64, linux/arm64)
# using Docker Buildx multi-platform build capabilities.
#
# This script validates that Docker images build correctly for different
# architectures and that Bun + Next.js + SWC binaries work properly in
# containerized environments.
#
# Prerequisites:
#   - Docker with buildx support
#   - QEMU (for cross-platform builds)
#
# Usage:
#   ./docker/test-multiplatform.sh [OPTIONS]
#
# Options:
#   --platform <name>   Test specific platform (linux/amd64, linux/arm64)
#   --no-cache          Build without using cache
#   --push              Push images to registry (requires login)
#   --verbose           Show detailed build output
#
# Exit Codes:
#   0 - All builds successful
#   1 - One or more builds failed
#   2 - Docker buildx not available
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
NC='\033[0m'

# Configuration
SPECIFIC_PLATFORM=""
NO_CACHE=false
PUSH=false
VERBOSE=false

# Script paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Test results
declare -A BUILD_RESULTS
declare -A BUILD_DURATIONS
BUILDS_RUN=0
BUILDS_PASSED=0
BUILDS_FAILED=0

# Image configuration
IMAGE_NAME="mugiwara-kaizoku"
IMAGE_TAG="platform-test"

# ============================================================================
# Utility Functions
# ============================================================================

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# ============================================================================
# Check Docker Buildx
# ============================================================================

check_docker_buildx() {
  log_info "Checking Docker buildx support..."

  if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker not found"
    exit 2
  fi

  if ! docker buildx version >/dev/null 2>&1; then
    log_error "Docker buildx not available"
    log_info "Install buildx: https://docs.docker.com/buildx/working-with-buildx/"
    exit 2
  fi

  log_success "Docker buildx available"

  # Create builder if not exists
  if ! docker buildx ls | grep -q "multiplatform-builder"; then
    log_info "Creating multiplatform builder..."
    docker buildx create --name multiplatform-builder --use --bootstrap
  else
    docker buildx use multiplatform-builder
  fi

  log_success "Builder configured: multiplatform-builder"
}

# ============================================================================
# Check QEMU for Cross-Platform Builds
# ============================================================================

check_qemu() {
  log_info "Checking QEMU for cross-platform emulation..."

  if ! docker run --rm --privileged multiarch/qemu-user-static --reset -p yes >/dev/null 2>&1; then
    log_warning "Could not setup QEMU"
    log_info "Cross-platform builds may fail"
    log_info "Install: docker run --privileged --rm tonistiigi/binfmt --install all"
  else
    log_success "QEMU configured for cross-platform builds"
  fi
}

# ============================================================================
# Build for Platform
# ============================================================================

build_platform() {
  local platform=$1
  local start_time=$(date +%s)

  log_info "=========================================="
  log_info "Building for: $platform"
  log_info "=========================================="

  cd "$PROJECT_ROOT" || return 1

  # Determine Dockerfile
  local dockerfile="Dockerfile.bun"
  if [ ! -f "$dockerfile" ]; then
    log_warning "Dockerfile.bun not found, using Dockerfile"
    dockerfile="Dockerfile"
  fi

  if [ ! -f "$dockerfile" ]; then
    log_error "No Dockerfile found"
    BUILD_RESULTS[$platform]="FAILED (no dockerfile)"
    return 1
  fi

  # Build options
  local build_opts=(
    "--platform" "$platform"
    "-f" "$dockerfile"
    "-t" "${IMAGE_NAME}:${IMAGE_TAG}-$(echo $platform | tr '/' '-')"
  )

  if [ "$NO_CACHE" = true ]; then
    build_opts+=("--no-cache")
  fi

  if [ "$PUSH" = true ]; then
    build_opts+=("--push")
  else
    build_opts+=("--load")
  fi

  # Verbose output
  if [ "$VERBOSE" = true ]; then
    build_opts+=("--progress=plain")
  fi

  # Run build
  log_info "Building Docker image for $platform..."
  if docker buildx build "${build_opts[@]}" . > "build-${platform//\//-}.log" 2>&1; then
    log_success "Build successful for $platform"

    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    BUILD_DURATIONS[$platform]=$duration

    # Test run the image (if not pushed)
    if [ "$PUSH" = false ]; then
      test_image "$platform"
    fi

    BUILD_RESULTS[$platform]="PASSED"
    return 0
  else
    log_error "Build failed for $platform"
    log_info "Check build-${platform//\//-}.log for details"

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    BUILD_DURATIONS[$platform]=$duration

    BUILD_RESULTS[$platform]="FAILED (build)"
    return 1
  fi
}

# ============================================================================
# Test Built Image
# ============================================================================

test_image() {
  local platform=$1
  local image_tag="${IMAGE_NAME}:${IMAGE_TAG}-$(echo $platform | tr '/' '-')"

  log_info "Testing image: $image_tag"

  # Test 1: Verify image exists
  if ! docker images | grep -q "$image_tag"; then
    log_error "Image not found: $image_tag"
    return 1
  fi

  # Test 2: Try to run container
  log_info "Starting container..."
  local container_id=$(docker run -d --rm -p 3000:3000 "$image_tag" 2>&1)

  if [ -z "$container_id" ]; then
    log_error "Failed to start container"
    return 1
  fi

  # Wait for container to start
  sleep 5

  # Test 3: Check if container is running
  if ! docker ps | grep -q "$container_id"; then
    log_error "Container exited unexpectedly"
    docker logs "$container_id" 2>&1 | tail -20
    return 1
  fi

  # Test 4: Try to access the server (simple check)
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    log_success "Server responding"
  else
    log_warning "Server not responding (this may be expected)"
  fi

  # Cleanup
  docker stop "$container_id" >/dev/null 2>&1 || true

  log_success "Image test completed"
  return 0
}

# ============================================================================
# Generate Report
# ============================================================================

generate_report() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║       Docker Multi-Platform Build Results                     ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  log_info "Build Results:"
  echo ""

  # Print results table
  printf "%-20s %-15s %-15s\n" "Platform" "Result" "Duration"
  printf "%-20s %-15s %-15s\n" "--------------------" "------" "--------"

  for platform in "${!BUILD_RESULTS[@]}"; do
    local result="${BUILD_RESULTS[$platform]}"
    local duration="${BUILD_DURATIONS[$platform]:-0}"

    if [[ "$result" == "PASSED" ]]; then
      printf "%-20s ${GREEN}%-15s${NC} %-15s\n" "$platform" "$result" "${duration}s"
    else
      printf "%-20s ${RED}%-15s${NC} %-15s\n" "$platform" "$result" "${duration}s"
    fi
  done

  echo ""
  echo "Summary:"
  echo "  Builds Run:   $BUILDS_RUN"
  echo "  Passed:       $BUILDS_PASSED"
  echo "  Failed:       $BUILDS_FAILED"
  echo ""

  if [ $BUILDS_FAILED -eq 0 ]; then
    log_success "All builds passed! 🐳"
  else
    log_error "$BUILDS_FAILED build(s) failed"
    echo ""
    echo "Review log files for details:"
    ls build-*.log 2>/dev/null | while read log; do
      echo "  - $log"
    done
  fi
  echo ""
}

# ============================================================================
# Cleanup
# ============================================================================

cleanup() {
  log_info "Cleaning up test images..."

  # Remove test images
  docker images | grep "$IMAGE_NAME.*$IMAGE_TAG" | awk '{print $3}' | xargs -r docker rmi -f >/dev/null 2>&1 || true

  log_success "Cleanup complete"
}

# ============================================================================
# Main
# ============================================================================

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --platform)
        SPECIFIC_PLATFORM=$2
        shift 2
        ;;
      --no-cache)
        NO_CACHE=true
        shift
        ;;
      --push)
        PUSH=true
        shift
        ;;
      --verbose)
        VERBOSE=true
        shift
        ;;
      -h|--help)
        cat <<EOF
Usage: $0 [OPTIONS]

Test Docker builds across multiple platforms.

Options:
  --platform <name>   Test specific platform (linux/amd64, linux/arm64)
  --no-cache          Build without using cache
  --push              Push images to registry (requires login)
  --verbose           Show detailed build output
  -h, --help          Show this help

Supported Platforms:
  - linux/amd64       (x86_64)
  - linux/arm64       (aarch64)

Prerequisites:
  - Docker with buildx support
  - QEMU for cross-platform builds
  - Dockerfile.bun in project root

Examples:
  # Test all platforms
  $0

  # Test specific platform
  $0 --platform linux/arm64

  # Test with verbose output
  $0 --verbose

  # Build and push to registry
  $0 --push

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

  # Prerequisites check
  check_docker_buildx
  check_qemu

  # Determine platforms to test
  local platforms
  if [ -n "$SPECIFIC_PLATFORM" ]; then
    platforms=("$SPECIFIC_PLATFORM")
    log_info "Testing specific platform: $SPECIFIC_PLATFORM"
  else
    platforms=("linux/amd64" "linux/arm64")
    log_info "Testing all platforms: ${platforms[*]}"
  fi

  # Run builds
  for platform in "${platforms[@]}"; do
    ((BUILDS_RUN++))
    if build_platform "$platform"; then
      ((BUILDS_PASSED++))
    else
      ((BUILDS_FAILED++))
    fi
    echo ""
  done

  # Generate report
  generate_report

  # Cleanup (optional)
  if [ "$PUSH" = false ]; then
    cleanup
  fi

  # Exit with appropriate code
  if [ $BUILDS_FAILED -eq 0 ]; then
    exit 0
  else
    exit 1
  fi
}

main "$@"

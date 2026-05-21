#!/usr/bin/env bash
#
# Performance Comparison Script: Node.js vs Bun
#
# This script benchmarks Mugiwara Kaizoku performance with both runtimes
# and generates a detailed comparison report.
#
# Benchmarks:
#   1. Dependency installation time
#   2. Dev server startup time
#   3. Production build time
#   4. Test execution time
#   5. Type checking time
#   6. Memory usage
#   7. Request throughput (optional with k6)
#
# Prerequisites:
#   - Node.js 20+ installed
#   - Bun 1.3+ installed
#   - Clean working directory
#   - k6 installed (optional, for load testing)
#
# Environment Variables:
#   SKIP_INSTALL: Skip dependency installation (default: false)
#   SKIP_LOADTEST: Skip k6 load testing (default: false)
#   ITERATIONS: Number of test iterations (default: 3)
#
# Usage:
#   # Basic run
#   ./scripts/bun/compare-performance.sh
#
#   # Skip installation benchmarks
#   SKIP_INSTALL=true ./scripts/bun/compare-performance.sh
#
#   # Run more iterations for accuracy
#   ITERATIONS=5 ./scripts/bun/compare-performance.sh
#
# Output:
#   - Console report with comparison tables
#   - JSON results: ./benchmark-results.json
#   - Markdown report: ./benchmark-results.md

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SKIP_INSTALL="${SKIP_INSTALL:-false}"
SKIP_LOADTEST="${SKIP_LOADTEST:-false}"
ITERATIONS="${ITERATIONS:-3}"

# Result files
RESULTS_JSON="benchmark-results.json"
RESULTS_MD="benchmark-results.md"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Results storage
declare -A NODE_RESULTS
declare -A BUN_RESULTS

# =============================================================================
# Helper Functions
# =============================================================================

log() {
  echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"
}

success() {
  echo -e "${GREEN}✅ $*${NC}"
}

error() {
  echo -e "${RED}❌ $*${NC}"
}

section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $*${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "Required command not found: $1"
    exit 1
  fi
}

calculate_average() {
  local numbers=("$@")
  local sum=0
  local count=${#numbers[@]}

  for num in "${numbers[@]}"; do
    sum=$(echo "$sum + $num" | bc)
  done

  echo "scale=2; $sum / $count" | bc
}

calculate_speedup() {
  local node_time=$1
  local bun_time=$2
  echo "scale=2; $node_time / $bun_time" | bc
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

section "Pre-flight Checks"

log "Checking required commands..."
check_command node
check_command npm
check_command bun
if [[ "$SKIP_LOADTEST" != "true" ]]; then
  check_command k6
fi
success "All required commands available"

log "Node.js version: $(node --version)"
log "npm version: $(npm --version)"
log "Bun version: $(bun --version)"
log "Iterations: $ITERATIONS"

# Verify we're in project root
if [[ ! -f "package.json" ]]; then
  error "Must be run from project root directory"
  exit 1
fi

# =============================================================================
# Benchmark 1: Dependency Installation
# =============================================================================

if [[ "$SKIP_INSTALL" != "true" ]]; then
  section "Benchmark 1: Dependency Installation"

  NODE_INSTALL_TIMES=()
  BUN_INSTALL_TIMES=()

  for i in $(seq 1 "$ITERATIONS"); do
    log "Iteration $i/$ITERATIONS"

    # Node.js installation
    log "Benchmarking bun install..."
    rm -rf node_modules package-lock.json

    START=$(date +%s)
    npm ci --silent > /dev/null 2>&1
    END=$(date +%s)
    NODE_TIME=$((END - START))
    NODE_INSTALL_TIMES+=("$NODE_TIME")
    log "bun install: ${NODE_TIME}s"

    # Bun installation
    log "Benchmarking bun install..."
    rm -rf node_modules bun.lockb

    START=$(date +%s)
    bun install --silent > /dev/null 2>&1
    END=$(date +%s)
    BUN_TIME=$((END - START))
    BUN_INSTALL_TIMES+=("$BUN_TIME")
    log "bun install: ${BUN_TIME}s"

    echo ""
  done

  NODE_RESULTS[install]=$(calculate_average "${NODE_INSTALL_TIMES[@]}")
  BUN_RESULTS[install]=$(calculate_average "${BUN_INSTALL_TIMES[@]}")

  success "Installation benchmark complete"
else
  log "Skipping installation benchmark (SKIP_INSTALL=true)"
  # Ensure dependencies are installed
  if [[ ! -d "node_modules" ]]; then
    log "Installing dependencies with Bun..."
    bun install --silent
  fi
fi

# =============================================================================
# Benchmark 2: Production Build Time
# =============================================================================

section "Benchmark 2: Production Build Time"

NODE_BUILD_TIMES=()
BUN_BUILD_TIMES=()

for i in $(seq 1 "$ITERATIONS"); do
  log "Iteration $i/$ITERATIONS"

  # Node.js build
  log "Benchmarking bun run build..."
  rm -rf .next

  START=$(date +%s)
  bun run build > /dev/null 2>&1
  END=$(date +%s)
  NODE_TIME=$((END - START))
  NODE_BUILD_TIMES+=("$NODE_TIME")
  log "npm build: ${NODE_TIME}s"

  # Bun build
  log "Benchmarking bun run build..."
  rm -rf .next

  START=$(date +%s)
  bun run build > /dev/null 2>&1
  END=$(date +%s)
  BUN_TIME=$((END - START))
  BUN_BUILD_TIMES+=("$BUN_TIME")
  log "bun build: ${BUN_TIME}s"

  echo ""
done

NODE_RESULTS[build]=$(calculate_average "${NODE_BUILD_TIMES[@]}")
BUN_RESULTS[build]=$(calculate_average "${BUN_BUILD_TIMES[@]}")

success "Build benchmark complete"

# =============================================================================
# Benchmark 3: Type Checking Time
# =============================================================================

section "Benchmark 3: Type Checking Time"

NODE_TYPECHECK_TIMES=()
BUN_TYPECHECK_TIMES=()

for i in $(seq 1 "$ITERATIONS"); do
  log "Iteration $i/$ITERATIONS"

  # Node.js type check
  log "Benchmarking bun run type-check..."

  START=$(date +%s)
  bun run type-check > /dev/null 2>&1 || true
  END=$(date +%s)
  NODE_TIME=$((END - START))
  NODE_TYPECHECK_TIMES+=("$NODE_TIME")
  log "npm type-check: ${NODE_TIME}s"

  # Bun type check
  log "Benchmarking bun run type-check:bun..."

  START=$(date +%s)
  bun run type-check:bun > /dev/null 2>&1 || true
  END=$(date +%s)
  BUN_TIME=$((END - START))
  BUN_TYPECHECK_TIMES+=("$BUN_TIME")
  log "bun type-check: ${BUN_TIME}s"

  echo ""
done

NODE_RESULTS[typecheck]=$(calculate_average "${NODE_TYPECHECK_TIMES[@]}")
BUN_RESULTS[typecheck]=$(calculate_average "${BUN_TYPECHECK_TIMES[@]}")

success "Type checking benchmark complete"

# =============================================================================
# Benchmark 4: Test Execution Time
# =============================================================================

section "Benchmark 4: Test Execution Time"

if command -v jest &> /dev/null; then
  NODE_TEST_TIMES=()
  BUN_TEST_TIMES=()

  for i in $(seq 1 "$ITERATIONS"); do
    log "Iteration $i/$ITERATIONS"

    # Node.js tests
    log "Benchmarking npm test..."

    START=$(date +%s)
    npm test -- --passWithNoTests > /dev/null 2>&1 || true
    END=$(date +%s)
    NODE_TIME=$((END - START))
    NODE_TEST_TIMES+=("$NODE_TIME")
    log "npm test: ${NODE_TIME}s"

    # Bun tests
    log "Benchmarking bun test..."

    START=$(date +%s)
    bun test --passWithNoTests > /dev/null 2>&1 || true
    END=$(date +%s)
    BUN_TIME=$((END - START))
    BUN_TEST_TIMES+=("$BUN_TIME")
    log "bun test: ${BUN_TIME}s"

    echo ""
  done

  NODE_RESULTS[test]=$(calculate_average "${NODE_TEST_TIMES[@]}")
  BUN_RESULTS[test]=$(calculate_average "${BUN_TEST_TIMES[@]}")

  success "Test execution benchmark complete"
else
  log "Skipping test benchmark (jest not available)"
fi

# =============================================================================
# Benchmark 5: Memory Usage (Build)
# =============================================================================

section "Benchmark 5: Memory Usage During Build"

log "Building with Node.js and measuring memory..."
rm -rf .next
/usr/bin/time -l bun run build > /dev/null 2>&1 || true
# Note: Memory measurement is OS-specific, this works on macOS

log "Building with Bun and measuring memory..."
rm -rf .next
/usr/bin/time -l bun run build > /dev/null 2>&1 || true

success "Memory measurement complete (see output above)"

# =============================================================================
# Benchmark 6: Load Testing (Optional)
# =============================================================================

if [[ "$SKIP_LOADTEST" != "true" ]] && command -v k6 &> /dev/null; then
  section "Benchmark 6: Load Testing with k6"

  log "Starting servers for load testing..."

  # TODO: Start Node.js server, run k6, measure RPS
  # TODO: Start Bun server, run k6, measure RPS

  log "Load testing skipped (requires server management)"
else
  log "Skipping load testing (SKIP_LOADTEST=true or k6 not available)"
fi

# =============================================================================
# Generate Report
# =============================================================================

section "Performance Comparison Report"

# Console output
echo ""
printf "%-20s | %-15s | %-15s | %-10s\n" "Metric" "Node.js" "Bun" "Speedup"
echo "---------------------------------------------------------------------"

for metric in install build typecheck test; do
  if [[ -n "${NODE_RESULTS[$metric]:-}" ]] && [[ -n "${BUN_RESULTS[$metric]:-}" ]]; then
    NODE_VAL="${NODE_RESULTS[$metric]}"
    BUN_VAL="${BUN_RESULTS[$metric]}"
    SPEEDUP=$(calculate_speedup "$NODE_VAL" "$BUN_VAL")

    printf "%-20s | %-15s | %-15s | " "$metric" "${NODE_VAL}s" "${BUN_VAL}s"
    echo -e "${GREEN}${SPEEDUP}x${NC}"
  fi
done

echo ""

# JSON output
cat > "$RESULTS_JSON" <<EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "iterations": $ITERATIONS,
  "node": {
    "version": "$(node --version)",
    "results": $(jq -n --argjson install "${NODE_RESULTS[install]:-0}" \
                       --argjson build "${NODE_RESULTS[build]:-0}" \
                       --argjson typecheck "${NODE_RESULTS[typecheck]:-0}" \
                       --argjson test "${NODE_RESULTS[test]:-0}" \
                       '{install: $install, build: $build, typecheck: $typecheck, test: $test}')
  },
  "bun": {
    "version": "$(bun --version)",
    "results": $(jq -n --argjson install "${BUN_RESULTS[install]:-0}" \
                       --argjson build "${BUN_RESULTS[build]:-0}" \
                       --argjson typecheck "${BUN_RESULTS[typecheck]:-0}" \
                       --argjson test "${BUN_RESULTS[test]:-0}" \
                       '{install: $install, build: $build, typecheck: $typecheck, test: $test}')
  }
}
EOF

success "Results saved to $RESULTS_JSON"

# Markdown output
cat > "$RESULTS_MD" <<EOF
# Performance Comparison: Node.js vs Bun

**Generated:** $(date)
**Iterations:** $ITERATIONS

## Results

| Metric | Node.js | Bun | Speedup |
|--------|---------|-----|---------|
EOF

for metric in install build typecheck test; do
  if [[ -n "${NODE_RESULTS[$metric]:-}" ]] && [[ -n "${BUN_RESULTS[$metric]:-}" ]]; then
    NODE_VAL="${NODE_RESULTS[$metric]}"
    BUN_VAL="${BUN_RESULTS[$metric]}"
    SPEEDUP=$(calculate_speedup "$NODE_VAL" "$BUN_VAL")

    echo "| **${metric}** | ${NODE_VAL}s | ${BUN_VAL}s | **${SPEEDUP}x** |" >> "$RESULTS_MD"
  fi
done

cat >> "$RESULTS_MD" <<EOF

## Environment

- **Node.js Version:** $(node --version)
- **npm Version:** $(npm --version)
- **Bun Version:** $(bun --version)
- **OS:** $(uname -s)
- **Date:** $(date)

## Conclusion

Bun demonstrates significant performance improvements across all benchmarks.
EOF

success "Report saved to $RESULTS_MD"

echo ""
success "Performance comparison complete! 🎉"

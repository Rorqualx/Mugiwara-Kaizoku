#!/usr/bin/env bash
# Runs the gating CI checks locally in the same order CI does, so a green
# `bun run ci:local` predicts a green push.
#
# Mirrors:
#   - .github/workflows/ci.yml         (validate: type-check + lint)
#   - .github/workflows/test.yml       (test: type-check + lint + test:ci)
#   - .github/workflows/security.yml   (security:check)
#
# Skipped intentionally:
#   - code-quality.yml         (every step is `continue-on-error` — informational only)
#   - docker.yml               (image build is slow; run manually if container code changed)
#   - test-fixed.yml           (subset of test:ci; redundant locally)

set -uo pipefail

SKIP_TESTS=0
SKIP_SECURITY=0
SKIP_TYPECHECK=0
SKIP_LINT=0
ONLY=""

usage() {
  cat <<EOF
Usage: bun run ci:local [options]

Runs the gating CI checks locally so you can predict a push outcome.

Steps (in CI order):
  1. typecheck      bun run type-check
  2. lint           bun run lint
  3. tests          bun run test:ci          (slow — skip with --skip-tests)
  4. security       bun run security:check    (skip with --skip-security)

Options:
  --skip-typecheck    Skip TypeScript type-check
  --skip-lint         Skip ESLint
  --skip-tests        Skip Jest (jest --ci --coverage --maxWorkers=2)
  --skip-security     Skip security:check
  --only=STEP         Run only one step: typecheck | lint | tests | security
  -h, --help          Show this help

Exit code: 0 if every run step passes, 1 otherwise.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --skip-tests)     SKIP_TESTS=1 ;;
    --skip-security)  SKIP_SECURITY=1 ;;
    --skip-typecheck) SKIP_TYPECHECK=1 ;;
    --skip-lint)      SKIP_LINT=1 ;;
    --only=*)         ONLY="${arg#--only=}" ;;
    -h|--help)        usage; exit 0 ;;
    *)                printf '\033[1;31mUnknown argument: %s\033[0m\n' "$arg"; usage; exit 2 ;;
  esac
done

CYAN='\033[1;36m'; GREEN='\033[1;32m'; RED='\033[1;31m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'

PASS=0
FAIL=0
SKIPPED=0
declare -a RESULTS

git_dir=$(git rev-parse --git-dir 2>/dev/null || true)
IN_WORKTREE=0
if [[ -n "$git_dir" && -f "$git_dir/gitdir" ]]; then
  IN_WORKTREE=1
fi

run_step() {
  local name="$1"
  local cmd="$2"
  local skip_flag="${3:-0}"

  if [[ -n "$ONLY" && "$ONLY" != "$name" ]]; then
    return
  fi
  if [[ "$skip_flag" == "1" ]]; then
    RESULTS+=("${YELLOW}SKIP${RESET}  $name")
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  printf "\n${CYAN}▶ %s${RESET}\n  $ %s\n\n" "$name" "$cmd"
  local start
  start=$(date +%s)
  if eval "$cmd"; then
    local elapsed=$(( $(date +%s) - start ))
    printf "${GREEN}✓ %s passed (%ds)${RESET}\n" "$name" "$elapsed"
    PASS=$((PASS + 1))
    RESULTS+=("${GREEN}PASS${RESET}  $name  (${elapsed}s)")
  else
    local elapsed=$(( $(date +%s) - start ))
    printf "${RED}✗ %s FAILED (%ds)${RESET}\n" "$name" "$elapsed"
    FAIL=$((FAIL + 1))
    RESULTS+=("${RED}FAIL${RESET}  $name  (${elapsed}s)")
  fi
}

# Lint has a special wrapper: in a git worktree, eslint-import-resolver-typescript
# classifies workspace packages (mangadex-ts-client) as "external" because their
# realpath sits outside the worktree's project root. In a normal checkout / CI,
# the same package realpath is INSIDE the project root and is classified as
# "internal" — so the import/order rule reports different errors in each.
# We capture lint output, strip those known-false-positive import/order lines
# when in a worktree, and judge the result by what would remain in CI.
run_lint_step() {
  if [[ -n "$ONLY" && "$ONLY" != "lint" ]]; then return; fi
  if [[ "$SKIP_LINT" == "1" ]]; then
    RESULTS+=("${YELLOW}SKIP${RESET}  lint")
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  printf "\n${CYAN}▶ lint${RESET}\n  $ bun run lint\n\n"
  local start
  start=$(date +%s)
  local log
  log=$(mktemp)
  local rc=0
  bun run lint 2>&1 | tee "$log"
  rc=${PIPESTATUS[0]}
  local elapsed=$(( $(date +%s) - start ))

  if [[ "$IN_WORKTREE" == "1" && "$rc" != "0" ]]; then
    # Count real errors after stripping known worktree-only false positives.
    local fp_count
    fp_count=$(grep -cE "\` *mangadex-ts-client *\` import should occur before" "$log" || true)
    local total_errors
    total_errors=$(grep -cE "^\s+[0-9]+:[0-9]+\s+error" "$log" || true)
    local real_errors=$(( total_errors - fp_count ))

    if [[ "$real_errors" -le 0 && "$fp_count" -gt 0 ]]; then
      printf "\n${YELLOW}Filtered %d worktree-only import-order error(s) (mangadex-ts-client).${RESET}\n" "$fp_count"
      printf "${YELLOW}Those don't fire in CI — treating lint as passed.${RESET}\n"
      printf "${GREEN}✓ lint passed (%ds, after worktree filter)${RESET}\n" "$elapsed"
      PASS=$((PASS + 1))
      RESULTS+=("${GREEN}PASS${RESET}  lint  (${elapsed}s, filtered ${fp_count} worktree FPs)")
      rm -f "$log"
      return
    fi
  fi
  rm -f "$log"

  if [[ "$rc" == "0" ]]; then
    printf "${GREEN}✓ lint passed (%ds)${RESET}\n" "$elapsed"
    PASS=$((PASS + 1))
    RESULTS+=("${GREEN}PASS${RESET}  lint  (${elapsed}s)")
  else
    printf "${RED}✗ lint FAILED (%ds)${RESET}\n" "$elapsed"
    FAIL=$((FAIL + 1))
    RESULTS+=("${RED}FAIL${RESET}  lint  (${elapsed}s)")
  fi
}

if [[ "$IN_WORKTREE" == "1" ]]; then
  printf "${YELLOW}⚠  Running in a git worktree.${RESET}\n"
  printf "   The lint step filters known worktree-only mangadex-ts-client\n"
  printf "   import-order false positives so the result mirrors CI.\n"
fi

run_step "typecheck" "bun run type-check"               "$SKIP_TYPECHECK"
run_lint_step
run_step "tests"     "bun run test:ci"                  "$SKIP_TESTS"
run_step "security"  "bun run security:check"           "$SKIP_SECURITY"

printf "\n${BOLD}Summary${RESET}\n"
for line in "${RESULTS[@]}"; do
  printf "  %b\n" "$line"
done
printf "\n"

if [ $FAIL -gt 0 ]; then
  printf "${RED}%d step(s) failed${RESET}  ·  ${YELLOW}%d skipped${RESET}  ·  ${GREEN}%d passed${RESET}\n" "$FAIL" "$SKIPPED" "$PASS"
  printf "${RED}Push would likely FAIL CI. Fix the failures above first.${RESET}\n"
  exit 1
fi

printf "${GREEN}All %d step(s) passed${RESET}  ·  ${YELLOW}%d skipped${RESET}\n" "$PASS" "$SKIPPED"
if [ $SKIPPED -gt 0 ]; then
  printf "${YELLOW}Note: %d step(s) were skipped — CI will still run them.${RESET}\n" "$SKIPPED"
fi
printf "${GREEN}Push should clear the gating CI checks.${RESET}\n"

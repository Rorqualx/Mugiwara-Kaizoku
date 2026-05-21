#!/usr/bin/env bash
# ==============================================================================
# Enrichment Quality Validation Script
#
# Validates manga metadata enrichment quality after pipeline runs.
# Checks volume assignments, chapter-level data coverage, and known
# regression cases to ensure changes don't break working manga.
#
# Usage:
#   ./scripts/validation/validate-enrichment-quality.sh                # All manga summary
#   ./scripts/validation/validate-enrichment-quality.sh --manga 213    # Specific manga
#   ./scripts/validation/validate-enrichment-quality.sh --regression    # Known regression cases
#   ./scripts/validation/validate-enrichment-quality.sh --snapshot      # Save baseline
#   ./scripts/validation/validate-enrichment-quality.sh --compare       # Compare against baseline
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

SNAPSHOT_FILE="$PROJECT_ROOT/scripts/validation/.enrichment-baseline.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==============================================================================
# Known regression cases — MUST pass after any pipeline change
# Format: mangaId|title|vol:chStart-chEnd|vol:chStart-chEnd|...|minVolCov|minTitleCov
# ==============================================================================
REGRESSION_CASES=(
  "213|Tokyo Revengers|1:1-5|2:6-14|3:15-23|0.95|0.90"
  # Add more as manga are fixed:
  # "185|Attack on Titan|1:1-4|2:5-8|3:9-12|0.80|0.90"
)

# ==============================================================================
# Helper: Run a SQL query via Prisma and return results
# ==============================================================================
run_query() {
  local query="$1"
  bun -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    const r = await p.\$queryRawUnsafe(\`$query\`);
    process.stdout.write(JSON.stringify(r));
    await p.\$disconnect();
  " 2>/dev/null
}

# ==============================================================================
# Get enrichment stats for a manga
# ==============================================================================
get_manga_stats() {
  local where_clause="$1"
  run_query "
    SELECT
      m.id, m.title,
      COUNT(*)::int as total_chapters,
      COUNT(c.title)::int as with_title,
      COUNT(c.volume)::int as with_volume,
      COUNT(c.\\\"releaseDate\\\")::int as with_release_date,
      (SELECT COUNT(*)::int FROM \\\"Volume\\\" v WHERE v.\\\"mangaId\\\" = m.id) as total_volumes,
      (SELECT COUNT(*)::int FROM \\\"Volume\\\" v WHERE v.\\\"mangaId\\\" = m.id AND v.\\\"chapterStart\\\" IS NOT NULL) as volumes_with_ranges
    FROM \\\"Chapter\\\" c
    JOIN \\\"Manga\\\" m ON c.\\\"mangaId\\\" = m.id
    $where_clause
    GROUP BY m.id, m.title
    ORDER BY m.title
  "
}

get_volume_assignments() {
  local manga_id="$1"
  run_query "
    SELECT volume, MIN(\\\"chapterNumber\\\")::int as ch_start, MAX(\\\"chapterNumber\\\")::int as ch_end, COUNT(*)::int as ch_count
    FROM \\\"Chapter\\\"
    WHERE \\\"mangaId\\\" = $manga_id AND volume IS NOT NULL
    GROUP BY volume
    ORDER BY volume
  "
}

# ==============================================================================
# Print manga stats
# ==============================================================================
print_manga_stats() {
  local stats_json="$1"
  local count
  count=$(echo "$stats_json" | jq 'length')

  for i in $(seq 0 $((count - 1))); do
    local manga
    manga=$(echo "$stats_json" | jq ".[$i]")
    local title total_ch with_title with_vol with_date total_vols vols_ranges
    title=$(echo "$manga" | jq -r '.title')
    local manga_id
    manga_id=$(echo "$manga" | jq -r '.id')
    total_ch=$(echo "$manga" | jq -r '.total_chapters')
    with_title=$(echo "$manga" | jq -r '.with_title')
    with_vol=$(echo "$manga" | jq -r '.with_volume')
    with_date=$(echo "$manga" | jq -r '.with_release_date')
    total_vols=$(echo "$manga" | jq -r '.total_volumes')
    vols_ranges=$(echo "$manga" | jq -r '.volumes_with_ranges')

    local title_pct vol_pct date_pct
    title_pct=$((with_title * 100 / (total_ch > 0 ? total_ch : 1)))
    vol_pct=$((with_vol * 100 / (total_ch > 0 ? total_ch : 1)))
    date_pct=$((with_date * 100 / (total_ch > 0 ? total_ch : 1)))

    local title_icon vol_icon date_icon
    title_icon=$( [ "$title_pct" -ge 90 ] && echo "✅" || ([ "$title_pct" -ge 50 ] && echo "⚠️" || echo "❌") )
    vol_icon=$( [ "$vol_pct" -ge 90 ] && echo "✅" || ([ "$vol_pct" -ge 50 ] && echo "⚠️" || echo "❌") )
    date_icon=$( [ "$date_pct" -ge 90 ] && echo "✅" || ([ "$date_pct" -ge 50 ] && echo "⚠️" || echo "❌") )

    echo -e "  ${BLUE}${title}${NC} (ID: ${manga_id})"
    echo "    Chapters: ${total_ch} total"
    echo "    ${title_icon} Titles: ${with_title}/${total_ch} (${title_pct}%)"
    echo "    ${vol_icon} Volumes: ${with_vol}/${total_ch} (${vol_pct}%)"
    echo "    ${date_icon} Dates: ${with_date}/${total_ch} (${date_pct}%)"
    echo "    Volume records: ${total_vols} (${vols_ranges} with ranges)"

    # Get volume assignments preview
    local vol_json
    vol_json=$(get_volume_assignments "$manga_id")
    local vol_count
    vol_count=$(echo "$vol_json" | jq 'length')
    if [ "$vol_count" -gt 0 ]; then
      local preview=""
      local max_preview=5
      for j in $(seq 0 $((vol_count > max_preview ? max_preview - 1 : vol_count - 1))); do
        local v
        v=$(echo "$vol_json" | jq ".[$j]")
        local vn vs ve vc
        vn=$(echo "$v" | jq -r '.volume')
        vs=$(echo "$v" | jq -r '.ch_start')
        ve=$(echo "$v" | jq -r '.ch_end')
        vc=$(echo "$v" | jq -r '.ch_count')
        preview="${preview}V${vn}:Ch${vs}-${ve}(${vc}) "
      done
      local more=""
      [ "$vol_count" -gt "$max_preview" ] && more=" +$((vol_count - max_preview)) more"
      echo "    Ranges: ${preview}${more}"
    fi
    echo ""
  done
}

# ==============================================================================
# Regression test
# ==============================================================================
run_regression_tests() {
  echo -e "\n🧪 ${BLUE}Regression Test Suite${NC}"
  echo "=================================================="

  local all_passed=true

  for case_str in "${REGRESSION_CASES[@]}"; do
    IFS='|' read -ra parts <<< "$case_str"
    local manga_id="${parts[0]}"
    local title="${parts[1]}"
    local min_vol_cov="${parts[${#parts[@]}-2]}"
    local min_title_cov="${parts[${#parts[@]}-1]}"

    # Get current data
    local stats_json
    stats_json=$(get_manga_stats "WHERE m.id = $manga_id")
    local count
    count=$(echo "$stats_json" | jq 'length')

    if [ "$count" -eq 0 ]; then
      echo -e "\n⏭️  ${title} (ID: ${manga_id}) — not in DB, skipping"
      continue
    fi

    local manga
    manga=$(echo "$stats_json" | jq '.[0]')
    local total_ch with_title with_vol
    total_ch=$(echo "$manga" | jq -r '.total_chapters')
    with_title=$(echo "$manga" | jq -r '.with_title')
    with_vol=$(echo "$manga" | jq -r '.with_volume')

    local passed=true
    local issues=()

    # Check coverage thresholds
    local title_cov vol_cov
    title_cov=$(echo "scale=2; $with_title / $total_ch" | bc)
    vol_cov=$(echo "scale=2; $with_vol / $total_ch" | bc)

    if (( $(echo "$title_cov < $min_title_cov" | bc -l) )); then
      passed=false
      issues+=("Title coverage ${title_cov} below minimum ${min_title_cov}")
    fi

    if (( $(echo "$vol_cov < $min_vol_cov" | bc -l) )); then
      passed=false
      issues+=("Volume coverage ${vol_cov} below minimum ${min_vol_cov} (${with_vol}/${total_ch})")
    fi

    # Check expected volume assignments
    local vol_json
    vol_json=$(get_volume_assignments "$manga_id")

    for k in $(seq 2 $((${#parts[@]} - 3))); do
      local expected="${parts[$k]}"
      local exp_vol exp_start exp_end
      exp_vol=$(echo "$expected" | cut -d: -f1)
      exp_start=$(echo "$expected" | cut -d: -f2 | cut -d- -f1)
      exp_end=$(echo "$expected" | cut -d: -f2 | cut -d- -f2)

      local actual
      actual=$(echo "$vol_json" | jq ".[] | select(.volume == $exp_vol)")

      if [ -z "$actual" ] || [ "$actual" = "null" ]; then
        passed=false
        issues+=("Vol ${exp_vol}: missing — expected Ch ${exp_start}-${exp_end}")
      else
        local act_start act_end
        act_start=$(echo "$actual" | jq -r '.ch_start')
        act_end=$(echo "$actual" | jq -r '.ch_end')

        if [ "$act_start" != "$exp_start" ] || [ "$act_end" != "$exp_end" ]; then
          passed=false
          issues+=("Vol ${exp_vol}: Ch ${act_start}-${act_end} — expected Ch ${exp_start}-${exp_end}")
        fi
      fi
    done

    # Print result
    if [ "$passed" = true ]; then
      echo -e "\n${GREEN}✅ ${title} (ID: ${manga_id})${NC}"
      echo "  All checks passed"
    else
      echo -e "\n${RED}❌ ${title} (ID: ${manga_id})${NC}"
      for issue in "${issues[@]}"; do
        echo -e "  ${RED}❌ ${issue}${NC}"
      done
      all_passed=false
    fi
  done

  echo ""
  echo "=================================================="
  if [ "$all_passed" = true ]; then
    echo -e "${GREEN}✅ All regression tests passed${NC}"
    exit 0
  else
    echo -e "${RED}❌ Some regression tests failed${NC}"
    exit 1
  fi
}

# ==============================================================================
# Snapshot
# ==============================================================================
save_snapshot() {
  local stats_json
  stats_json=$(get_manga_stats "WHERE (SELECT COUNT(*) FROM \"Chapter\" c2 WHERE c2.\"mangaId\" = m.id) > 0")
  echo "$stats_json" > "$SNAPSHOT_FILE"
  local count
  count=$(echo "$stats_json" | jq 'length')
  echo -e "${GREEN}Snapshot saved: ${count} manga${NC}"
}

compare_snapshot() {
  if [ ! -f "$SNAPSHOT_FILE" ]; then
    echo -e "${RED}No baseline snapshot found. Run with --snapshot first.${NC}"
    exit 1
  fi

  local baseline
  baseline=$(cat "$SNAPSHOT_FILE")
  local current
  current=$(get_manga_stats "WHERE (SELECT COUNT(*) FROM \"Chapter\" c2 WHERE c2.\"mangaId\" = m.id) > 0")

  echo -e "\n📊 ${BLUE}Comparing against baseline${NC}"
  echo "=================================================="

  local regressions=0
  local improvements=0
  local current_count
  current_count=$(echo "$current" | jq 'length')

  for i in $(seq 0 $((current_count - 1))); do
    local curr
    curr=$(echo "$current" | jq ".[$i]")
    local manga_id title
    manga_id=$(echo "$curr" | jq -r '.id')
    title=$(echo "$curr" | jq -r '.title')

    local base
    base=$(echo "$baseline" | jq ".[] | select(.id == $manga_id)")

    if [ -z "$base" ] || [ "$base" = "null" ]; then
      continue
    fi

    local curr_title curr_vol base_title base_vol
    curr_title=$(echo "$curr" | jq -r '.with_title')
    curr_vol=$(echo "$curr" | jq -r '.with_volume')
    base_title=$(echo "$base" | jq -r '.with_title')
    base_vol=$(echo "$base" | jq -r '.with_volume')

    local title_delta=$((curr_title - base_title))
    local vol_delta=$((curr_vol - base_vol))

    if [ "$title_delta" -lt 0 ] || [ "$vol_delta" -lt 0 ]; then
      regressions=$((regressions + 1))
      echo -e "  ${RED}[REGRESSION]${NC} ${title}:"
      [ "$title_delta" -lt 0 ] && echo "    Titles: ${base_title} -> ${curr_title} (${title_delta})"
      [ "$vol_delta" -lt 0 ] && echo "    Volumes: ${base_vol} -> ${curr_vol} (${vol_delta})"
    elif [ "$title_delta" -gt 0 ] || [ "$vol_delta" -gt 0 ]; then
      improvements=$((improvements + 1))
      echo -e "  ${GREEN}[IMPROVED]${NC} ${title}:"
      [ "$title_delta" -gt 0 ] && echo "    Titles: ${base_title} -> ${curr_title} (+${title_delta})"
      [ "$vol_delta" -gt 0 ] && echo "    Volumes: ${base_vol} -> ${curr_vol} (+${vol_delta})"
    fi
  done

  echo ""
  echo "=================================================="
  local unchanged=$((current_count - improvements - regressions))
  echo "Summary: ${improvements} improved, ${regressions} regressed, ${unchanged} unchanged"

  [ "$regressions" -gt 0 ] && exit 1
  exit 0
}

# ==============================================================================
# Main
# ==============================================================================

case "${1:-}" in
  --regression)
    run_regression_tests
    ;;
  --snapshot)
    save_snapshot
    ;;
  --compare)
    compare_snapshot
    ;;
  --manga)
    manga_id="${2:?Usage: --manga <id>}"
    echo -e "\n📊 ${BLUE}Enrichment Quality Report${NC}"
    echo "=================================================="
    stats=$(get_manga_stats "WHERE m.id = $manga_id")
    print_manga_stats "$stats"
    ;;
  *)
    echo -e "\n📊 ${BLUE}Enrichment Quality Report${NC}"
    echo "=================================================="
    stats=$(get_manga_stats "WHERE (SELECT COUNT(*) FROM \"Chapter\" c2 WHERE c2.\"mangaId\" = m.id) > 0")
    print_manga_stats "$stats"
    ;;
esac

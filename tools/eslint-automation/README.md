# ESLint Automation Tools

Scripts to accelerate ESLint violation fixes while maintaining code quality.

## Quick Start

```bash
# Phase 1: Instant win (2 mins)
./1-fix-import-order.sh

# Phase 2A: Fix unused vars (20 mins)
./2a-fix-unused-vars.py --dry-run
./2a-fix-unused-vars.py --execute

# Phase 2B: Add return types (30 mins)
./2b-add-return-types.py --dry-run
./2b-add-return-types.py --execute

# Track progress
./track-progress.sh
```

## Safety

All scripts:
- Create backups before modifying
- Support --dry-run mode
- Validate with type-check after
- Commit in small batches

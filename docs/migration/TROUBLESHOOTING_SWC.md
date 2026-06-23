# Troubleshooting Next.js SWC Binary Issues

*Status: Active*
*Last Updated: 2025-10-15*
*Canonical: Yes*

---

## Overview

This guide provides comprehensive troubleshooting for Next.js SWC (Speedy Web Compiler) binary issues when using Bun 1.3+ runtime. SWC binary issues are the most common cause of build failures after migrating to Bun.

---

## Table of Contents

1. [Understanding SWC Binaries](#understanding-swc-binaries)
2. [Common Error Messages](#common-error-messages)
3. [Root Causes](#root-causes)
4. [Quick Fixes](#quick-fixes)
5. [Detailed Troubleshooting](#detailed-troubleshooting)
6. [Manual Fixes](#manual-fixes)
7. [Prevention](#prevention)
8. [Platform-Specific Issues](#platform-specific-issues)

---

## Understanding SWC Binaries

### What is SWC?

SWC (Speedy Web Compiler) is a Rust-based compiler used by Next.js for:
- **Transpilation**: TypeScript → JavaScript, JSX → JavaScript
- **Minification**: Production code optimization
- **Bundling**: Module resolution and bundling

### Why Platform-Specific?

SWC is a **native binary** (compiled Rust code), not JavaScript. Each platform requires a different binary:

```
macOS ARM64    → @next/swc-darwin-arm64
macOS x86_64   → @next/swc-darwin-x64
Linux ARM64    → @next/swc-linux-arm64-gnu
Linux x86_64   → @next/swc-linux-x64-gnu
Windows x64    → @next/swc-win32-x64-msvc
Windows ARM64  → @next/swc-win32-arm64-msvc
```

### How Next.js Finds SWC

Next.js looks for the SWC binary in this order:

1. `node_modules/@next/swc-<platform>/`
2. Fallback to JavaScript-based SWC (slower)

---

## Common Error Messages

### Error 1: "Cannot find module '@next/swc-*'"

**Full Error**:
```
Error: Cannot find module '@next/swc-darwin-arm64'
Require stack:
- /path/to/node_modules/next/dist/build/swc/index.js
```

**Meaning**: The required SWC binary package is not installed or not accessible.

**Quick Fix**:
```bash
./scripts/bun/fix-swc-binaries.sh
```

---

### Error 2: "ENOENT: no such file or directory"

**Full Error**:
```
ENOENT: no such file or directory, open 'node_modules/@next/swc-darwin-arm64/swc.node'
```

**Meaning**: SWC package directory exists but the actual binary file is missing.

**Quick Fix**:
```bash
./scripts/bun/fix-swc-binaries.sh --force
```

---

### Error 3: "Module did not self-register"

**Full Error**:
```
Error: Module did not self-register.
    at Object.Module._extensions..node (node:internal/modules/cjs/loader:1340:18)
```

**Meaning**: Wrong architecture binary loaded (e.g., x86_64 binary on ARM64 system).

**Quick Fix**:
```bash
# Clean and reinstall
rm -rf node_modules
rm bun.lock
bun install
```

---

### Error 4: Symlink Points to Non-Existent File

**Full Error**:
```
Error: ENOENT: no such file or directory, stat 'node_modules/.pnpm/node_modules/@next/swc-darwin-arm64'
```

**Meaning**: bun run virtual store symlink is broken.

**Quick Fix**:
```bash
./scripts/bun/fix-swc-binaries.sh --verbose
```

---

## Root Causes

### Cause 1: Architecture Mismatch

**Scenario**: System reports one architecture, Bun installed for different architecture.

**Example**: ARM Mac running Rosetta 2 (x86_64 emulation) with ARM64 Bun binary.

**Detection**:
```bash
uname -m              # Shows x86_64 (Rosetta)
file $(which bun)     # Shows arm64
```

**Why it happens**:
- Terminal running under Rosetta 2
- Bun installer detects true ARM architecture
- Bun installs ARM64 binary
- Package manager sees x86_64 and installs x86_64 SWC binary
- **Mismatch!**

**Fix**: Run platform detection and auto-fix:
```bash
./scripts/bun/platform-detect.sh --verbose
./scripts/bun/fix-swc-binaries.sh
```

---

### Cause 2: bun run Virtual Store Symlinks

**Scenario**: Using bun run with Bun.

**How bun run works**:
```
node_modules/
  .pnpm/
    next@14.1.0_<hash>/
      node_modules/
        next/
          dist/
            build/
              swc/
                index.js  # Looks for: ../../../@next/swc-darwin-arm64
        @next/
          swc-darwin-arm64/  # Should be symlinked here
  @next/
    swc-darwin-arm64/  # Actual binary installed here
```

**Problem**: Next.js (inside .pnpm) looks for SWC binary relative to itself, but bun run places it outside the virtual store.

**Fix**: Create symlink in virtual store:
```bash
./scripts/bun/fix-swc-binaries.sh
```

---

### Cause 3: Missing Optional Dependency

**Scenario**: Package manager skipped optional dependencies.

**Why it happens**:
- SWC binaries are optional dependencies in Next.js
- Some configurations skip optional deps
- Network issues during installation

**Fix**: Install explicitly:
```bash
# Detect required binary
REQUIRED_SWC=$(./scripts/bun/platform-detect.sh --json | grep requiredSwcBinary | cut -d'"' -f4)

# Install it
bun add -d "$REQUIRED_SWC"
```

---

### Cause 4: Corrupted Installation

**Scenario**: Incomplete or interrupted installation.

**Symptoms**:
- Package directory exists
- Binary file missing or incomplete
- Symlinks point to nothing

**Fix**: Force reinstall:
```bash
rm -rf node_modules
rm bun.lock  # or pnpm-lock.yaml, package-lock.json
bun install   # or bun install, npm install
```

---

## Quick Fixes

### Fix 1: Auto-Fix Script (Recommended)

```bash
./scripts/bun/fix-swc-binaries.sh
```

**What it does**:
1. Detects your platform
2. Determines required SWC binary
3. Checks if binary exists
4. Fixes broken symlinks (pnpm)
5. Installs missing binaries
6. Validates installation

**Dry run** (see what would be fixed):
```bash
./scripts/bun/fix-swc-binaries.sh --dry-run --verbose
```

---

### Fix 2: Force Reinstall

```bash
./scripts/bun/fix-swc-binaries.sh --force
```

**What it does**:
- Removes existing SWC binary
- Reinstalls from scratch
- Fixes any symlink issues

---

### Fix 3: Clean Reinstall

```bash
# 1. Clean everything
rm -rf node_modules
rm bun.lock pnpm-lock.yaml package-lock.json yarn.lock

# 2. Reinstall
bun install  # or bun install, npm install

# 3. Verify
./scripts/bun/platform-detect.sh
```

---

### Fix 4: Manual SWC Installation

```bash
# 1. Detect required binary
./scripts/bun/platform-detect.sh

# 2. Install manually (example for macOS ARM64)
bun add -d @next/swc-darwin-arm64

# 3. Verify
ls -la node_modules/@next/swc-darwin-arm64/
```

---

## Detailed Troubleshooting

### Step 1: Identify Your Platform

```bash
./scripts/bun/platform-detect.sh --verbose
```

**Key information**:
- OS: darwin, linux, win32
- Architecture: x64, arm64
- Bun architecture (may differ from system arch!)
- Required SWC binary
- Whether SWC binary exists

---

### Step 2: Check SWC Binary Installation

```bash
# Get required binary name
REQUIRED_SWC=$(./scripts/bun/platform-detect.sh --json | grep requiredSwcBinary | cut -d'"' -f4)

# Check if directory exists
ls -la "node_modules/$REQUIRED_SWC/"

# Check if binary file exists
ls -la "node_modules/$REQUIRED_SWC/swc.node" || \
ls -la "node_modules/$REQUIRED_SWC/next-swc.node"
```

**Expected output**:
```
-rw-r--r--  1 user  staff  12345678 Oct 15 10:00 swc.node
-rw-r--r--  1 user  staff      1234 Oct 15 10:00 package.json
```

---

### Step 3: Check for Symlink Issues (pnpm)

```bash
# Find Next.js in bun run virtual store
find node_modules/.bun run -name "next@14.1.0*" -type d

# Check symlinks in virtual store
NEXT_PNPM=$(find node_modules/.bun run -name "next@14.1.0*" -type d | head -1)
ls -la "$NEXT_PNPM/node_modules/@next/"
```

**What to look for**:
```
swc-darwin-arm64 -> ../../../../@next/swc-darwin-arm64  # Good
```

**Broken symlink** (bad):
```
swc-darwin-arm64 -> ../../../.pnpm/@next+swc-darwin-arm64@...  # Broken
```

---

### Step 4: Verify Binary Architecture

```bash
# Check binary file type
REQUIRED_SWC=$(./scripts/bun/platform-detect.sh --json | grep requiredSwcBinary | cut -d'"' -f4)
file "node_modules/$REQUIRED_SWC/swc.node"
```

**Expected output** (macOS ARM64):
```
Mach-O 64-bit dynamically linked shared library arm64
```

**Wrong architecture** (would show x86_64 on ARM64):
```
Mach-O 64-bit dynamically linked shared library x86_64
```

---

### Step 5: Test Manual Load

```bash
# Try to load SWC binary with Node.js
node -e "console.log(require('@next/swc-darwin-arm64'))"
```

**Success**:
```
{ transform: [Function], ... }
```

**Failure**:
```
Error: Cannot find module '@next/swc-darwin-arm64'
```

---

## Manual Fixes

### Manual Fix 1: Create bun run Symlink

```bash
# 1. Find Next.js in virtual store
NEXT_PNPM=$(find node_modules/.bun run -name "next@14.1.0*" -type d | head -1)

# 2. Detect required SWC binary
REQUIRED_SWC=$(./scripts/bun/platform-detect.sh --json | grep requiredSwcBinary | cut -d'"' -f4)
SWC_NAME=$(basename "$REQUIRED_SWC")

# 3. Create parent directory
mkdir -p "$NEXT_PNPM/node_modules/@next"

# 4. Remove broken symlink if exists
rm -f "$NEXT_PNPM/node_modules/@next/$SWC_NAME"

# 5. Create correct symlink
cd "$NEXT_PNPM/node_modules/@next"
ln -s "../../../../$REQUIRED_SWC" "$SWC_NAME"

# 6. Verify
ls -la "$NEXT_PNPM/node_modules/@next/$SWC_NAME"
```

---

### Manual Fix 2: Force Install Correct Binary

```bash
# 1. Remove wrong binary
rm -rf node_modules/@next/swc-*

# 2. Detect and install correct binary
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$PLATFORM" = "darwin" ]; then
  if [ "$ARCH" = "arm64" ]; then
    bun add -d @next/swc-darwin-arm64
  else
    bun add -d @next/swc-darwin-x64
  fi
elif [ "$PLATFORM" = "linux" ]; then
  if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    bun add -d @next/swc-linux-arm64-gnu
  else
    bun add -d @next/swc-linux-x64-gnu
  fi
fi
```

---

### Manual Fix 3: npm Rebuild

```bash
# Sometimes npm rebuild fixes native modules
npm rebuild @next/swc-darwin-arm64
```

---

## Prevention

### 1. Always Run Compatibility Check

Add to your workflow:

```bash
# Before starting dev server
./.claude/hooks/check-bun-compatibility.sh

# Automatically fixes issues
bun --bun run dev
```

---

### 2. Use Auto-Fix in CI/CD

In `.github/workflows/test-platforms.yml`:

```yaml
- name: Check and fix SWC binaries
  run: |
    chmod +x scripts/bun/fix-swc-binaries.sh
    ./scripts/bun/fix-swc-binaries.sh --verbose
```

---

### 3. Commit Correct Lockfiles

- **With Bun**: Commit `bun.lock`
- **With pnpm**: Commit `pnpm-lock.yaml`
- **Don't mix**: Only commit one lockfile type

---

### 4. Document Platform

In your README or `.env`:

```bash
# Platform: macOS ARM64
# Bun: 1.3.0
# Required SWC: @next/swc-darwin-arm64
```

---

## Platform-Specific Issues

### macOS ARM64 (Apple Silicon) + Rosetta 2

**Problem**: Terminal running in Rosetta 2 mode.

**Detection**:
```bash
arch  # Shows i386 or x86_64 (Rosetta)
```

**Fix**: Run Terminal in native ARM mode:
1. Quit Terminal
2. Get Info on Terminal.app
3. **Uncheck** "Open using Rosetta"
4. Restart Terminal
5. Verify: `arch` should show `arm64`

**Alternative**: Install x86_64 Bun:
```bash
# Remove ARM Bun
rm -rf ~/.bun

# Install x86 Bun
arch -x86_64 /bin/bash -c "$(curl -fsSL https://bun.sh/install)"
```

---

### macOS Intel + Homebrew

**Problem**: Homebrew paths not in PATH.

**Fix**:
```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="/usr/local/bin:$PATH"
```

---

### Linux ARM64 + pnpm

**Problem**: bun run symlinks more complex on ARM64.

**Fix**: Use auto-fix script (handles ARM-specific paths):
```bash
./scripts/bun/fix-swc-binaries.sh --verbose
```

---

### Windows WSL2

**Problem**: Mixed Windows/Linux paths.

**Fix**: Keep project in WSL filesystem:
```bash
# Good
cd ~/projects/mugiwara-kaizoku

# Bad
cd /mnt/c/Users/username/projects/mugiwara-kaizoku
```

---

## Advanced Debugging

### Enable Next.js Debug Mode

```bash
DEBUG=* npm run build
```

Shows detailed SWC loading attempts.

---

### Trace SWC Loading

Add to `next.config.js`:

```javascript
module.exports = {
  experimental: {
    swcTraceProfiling: true,
  },
}
```

---

### Check Bun Module Resolution

```bash
bun --print 'import.meta.resolveSync("@next/swc-darwin-arm64")'
```

---

## Getting Help

If auto-fix doesn't work:

1. **Gather diagnostic info**:
   ```bash
   ./scripts/bun/platform-detect.sh --verbose > platform-info.txt
   ./scripts/bun/fix-swc-binaries.sh --dry-run --verbose > fix-analysis.txt
   ```

2. **Check existing issues**: Search GitHub issues for similar problems

3. **Create issue** with:
   - Platform info (platform-info.txt)
   - Fix analysis (fix-analysis.txt)
   - Error messages
   - Steps to reproduce

---

*Last Updated: October 15, 2025*
*For general platform compatibility, see: [PLATFORM_COMPATIBILITY.md](./PLATFORM_COMPATIBILITY.md)*
*For Bun migration guide, see: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)*

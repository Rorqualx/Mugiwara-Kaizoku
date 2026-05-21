# Platform Compatibility Guide

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-10-15*
*Canonical: Yes*

---

## Overview

This guide documents platform compatibility for Mugiwara Kaizoku with Bun 1.3+ runtime, covering all supported operating systems, architectures, and package managers. It provides comprehensive information about platform-specific issues, especially Next.js SWC binary compatibility.

---

## Table of Contents

1. [Supported Platforms](#supported-platforms)
2. [Platform Detection](#platform-detection)
3. [SWC Binary Compatibility](#swc-binary-compatibility)
4. [Package Manager Compatibility](#package-manager-compatibility)
5. [Known Issues by Platform](#known-issues-by-platform)
6. [Testing Platforms](#testing-platforms)
7. [CI/CD Platform Matrix](#cicd-platform-matrix)
8. [Docker Multi-Platform Builds](#docker-multi-platform-builds)
9. [Troubleshooting](#troubleshooting)

---

## Supported Platforms

### Operating Systems

| OS | Versions | x86_64 | ARM64 | Status |
|----|----------|--------|-------|--------|
| **macOS** | 14+ (Sonoma) | ✅ | ✅ | Fully Supported |
| **macOS** | 13 (Ventura) | ✅ | ✅ | Fully Supported |
| **Linux** | Ubuntu 22.04+ | ✅ | ✅ | Fully Supported |
| **Linux** | Debian 11+ | ✅ | ✅ | Fully Supported |
| **Linux** | Fedora 38+ | ✅ | ✅ | Supported |
| **Windows** | 10/11 (WSL2) | ✅ | ⚠️ | Supported via WSL2 |

### Package Managers

| Package Manager | Version | Status | Notes |
|----------------|---------|--------|-------|
| **Bun** | 1.3.0+ | ✅ | Recommended (15x faster install) |
| **pnpm** | 10.7.1+ | ✅ | Fully Supported |
| **npm** | 10.0.0+ | ✅ | Fully Supported |
| **Yarn** | 1.22+ | ✅ | Supported (Classic only) |

### Runtime Requirements

- **Node.js**: 20.0.0+ (when using npm/pnpm/yarn)
- **Bun**: 1.3.0+ (when using Bun as runtime)
- **PostgreSQL**: 15+ (database)
- **Java**: 11+ (optional, for Suwayomi integration)

---

## Platform Detection

### Automatic Detection

The project includes an automated platform detection script:

```bash
./scripts/bun/platform-detect.sh
```

**Output includes:**
- Operating system and version
- System architecture (x86_64, ARM64)
- Bun installation status and architecture
- Node.js installation status
- Package manager type and version
- Required Next.js SWC binary
- SWC binary existence check
- Rosetta 2 detection (macOS)
- Docker/CI environment detection

### JSON Output

For programmatic use:

```bash
./scripts/bun/platform-detect.sh --json
```

**Example output:**

```json
{
  "os": "darwin",
  "osVersion": "15.6",
  "arch": "x64",
  "bunInstalled": true,
  "bunVersion": "1.3.0",
  "bunArch": "arm64",
  "nodeInstalled": true,
  "nodeVersion": "23.11.0",
  "packageManager": "pnpm",
  "packageManagerVersion": "10.7.1",
  "nextVersion": "14.1.0",
  "requiredSwcBinary": "@next/swc-darwin-arm64",
  "swcBinaryExists": true,
  "isRosetta": true,
  "isDocker": false,
  "isCI": false
}
```

---

## SWC Binary Compatibility

### What are SWC Binaries?

Next.js uses SWC (Speedy Web Compiler) for:
- JavaScript/TypeScript compilation
- Minification
- Bundling optimizations

SWC is a native binary (written in Rust) that varies by platform:

| Platform | SWC Package |
|----------|-------------|
| macOS ARM64 | `@next/swc-darwin-arm64` |
| macOS x86_64 | `@next/swc-darwin-x64` |
| Linux ARM64 | `@next/swc-linux-arm64-gnu` |
| Linux x86_64 | `@next/swc-linux-x64-gnu` |
| Windows x86_64 | `@next/swc-win32-x64-msvc` |
| Windows ARM64 | `@next/swc-win32-arm64-msvc` |

### Common SWC Issues

#### Issue 1: Architecture Mismatch

**Scenario**: ARM Mac running Rosetta 2 (x86_64 emulation) + Bun (ARM64 native)

**Symptom**:
```
Error: Cannot find module '@next/swc-darwin-arm64'
```

**Cause**: Package manager installed SWC binary for x64, but Bun expects ARM64 binary.

**Solution**: Run auto-fix script:
```bash
./scripts/bun/fix-swc-binaries.sh
```

#### Issue 2: pnpm Virtual Store Symlinks

**Scenario**: Using pnpm with Bun

**Symptom**: Next.js cannot find SWC binary despite it being installed.

**Cause**: pnpm uses virtual store with symlinks. Next.js expects SWC binary in specific location relative to Next.js package.

**Solution**: Auto-fix creates correct symlinks:
```bash
./scripts/bun/fix-swc-binaries.sh --verbose
```

**Manual fix** (if needed):
```bash
# Find Next.js in pnpm virtual store
NEXT_PATH=$(find node_modules/.pnpm -name "next@14.1.0*" -type d | head -1)

# Create symlink to SWC binary
cd "$NEXT_PATH/node_modules/@next"
ln -s "../../../../@next/swc-darwin-arm64" "swc-darwin-arm64"
```

#### Issue 3: Missing SWC Binary

**Symptom**: SWC binary package not installed at all.

**Cause**: Package manager didn't install optional dependencies.

**Solution**:
```bash
# With Bun
bun add -d @next/swc-darwin-arm64

# With pnpm
pnpm add -D @next/swc-darwin-arm64

# With npm
npm install --save-dev @next/swc-darwin-arm64
```

---

## Package Manager Compatibility

### pnpm (Recommended for Node.js)

**Version**: 10.7.1+

**Pros**:
- Efficient disk space usage (hard links)
- Fast installation
- Strict dependency resolution

**Cons**:
- Virtual store can cause symlink issues with Bun
- Requires auto-fix for SWC binaries

**Setup**:
```bash
npm install -g pnpm@10.7.1
pnpm install
```

**With Bun**:
```bash
# Run compatibility check first
./.claude/hooks/check-bun-compatibility.sh

# Start dev server
bun --bun run dev
```

### Bun (Recommended Overall)

**Version**: 1.3.0+

**Pros**:
- 15x faster installation
- Native TypeScript support
- Built-in bundler
- Unified runtime and package manager

**Cons**:
- Newer ecosystem (some edge cases)
- Binary lockfile (not human-readable)

**Setup**:
```bash
curl -fsSL https://bun.sh/install | bash
bun install
bun --bun run dev
```

**Lockfile Management**:
- Uses `bun.lockb` (binary format)
- Cannot be edited manually
- Must delete and regenerate if corrupted

### npm (Universal Compatibility)

**Version**: 10.0.0+

**Pros**:
- Universally available
- Stable and well-tested
- Flat node_modules structure (less symlink issues)

**Cons**:
- Slower than pnpm and Bun
- Larger disk usage

**Setup**:
```bash
npm install
npm run dev
```

### Yarn Classic

**Version**: 1.22.19+

**Pros**:
- Widely used
- Offline mode support
- Workspaces support

**Cons**:
- Slower than pnpm and Bun
- Yarn Berry (2.x+) not yet tested

**Setup**:
```bash
npm install -g yarn@1.22.19
yarn install
yarn dev
```

---

## Known Issues by Platform

### macOS ARM64 (Apple Silicon)

**Issue**: Rosetta 2 + Bun Architecture Mismatch

**Details**:
- Shell running under Rosetta 2 (x86_64)
- Bun installed as ARM64 native binary
- System reports as x86_64 but Bun is ARM64
- SWC binary mismatch

**Detection**:
```bash
uname -m  # Shows x86_64 (Rosetta)
file $(which bun)  # Shows arm64 binary
```

**Solution**: Auto-detected and fixed by:
```bash
./.claude/hooks/check-bun-compatibility.sh
```

**Prevention**:
- Run Terminal in native ARM mode (not Rosetta)
- Or install Bun for x86_64 architecture

### macOS x86_64 (Intel)

**Issue**: Homebrew Java Path

**Details**: Java 21 from Homebrew needs explicit PATH setup.

**Solution** (already in dev scripts):
```bash
export PATH="/usr/local/opt/openjdk@21/bin:$PATH"
export JAVA_HOME="/usr/local/opt/openjdk@21"
```

### Linux ARM64

**Issue**: Missing QEMU for Docker Multi-Platform

**Details**: Building Docker images for other architectures requires QEMU.

**Solution**:
```bash
docker run --privileged --rm tonistiigi/binfmt --install all
```

### Linux x86_64

**Status**: Generally stable, fewest issues.

**Recommendation**: Preferred platform for CI/CD.

### Windows (WSL2)

**Issue**: WSL2 File System Performance

**Details**: Cross-filesystem operations (Windows ↔ WSL2) are slow.

**Solution**:
- Keep project files within WSL2 filesystem
- Use `/home/username/projects/` not `/mnt/c/Users/`

**WSL2 Setup**:
```bash
# Install WSL2
wsl --install -d Ubuntu-22.04

# Inside WSL2
curl -fsSL https://bun.sh/install | bash
cd ~
git clone <repo-url>
cd mugiwara-kaizoku
bun install
```

---

## Testing Platforms

### Local Testing

Test all available package managers locally:

```bash
./scripts/bun/test-platform-matrix.sh
```

**Options**:
```bash
# Test specific package manager
./scripts/bun/test-platform-matrix.sh --pm pnpm

# Skip builds (faster)
./scripts/bun/test-platform-matrix.sh --skip-build

# Clean between tests
./scripts/bun/test-platform-matrix.sh --clean
```

**Output**:
- Installation success/failure
- SWC binary compatibility
- Build success/failure
- Duration metrics
- Detailed logs per package manager

### Compatibility Check

Before starting development:

```bash
./.claude/hooks/check-bun-compatibility.sh
```

**Checks performed**:
1. Required scripts existence
2. Bun installation
3. Platform compatibility
4. SWC binary validation
5. Package manager detection
6. node_modules integrity

**Auto-fixes**:
- Missing SWC binaries
- Broken symlinks
- Architecture mismatches

---

## CI/CD Platform Matrix

### GitHub Actions Workflow

Location: `.github/workflows/test-platforms.yml`

**Tested combinations**:

| OS | Architecture | Package Managers |
|----|--------------|------------------|
| Ubuntu 22.04 | x86_64 | pnpm, npm, yarn, bun |
| macOS 14 | ARM64 | pnpm, npm, yarn, bun |
| macOS 13 | x86_64 | pnpm, bun |

**Workflow runs on**:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Package/lockfile changes
- Manual trigger
- Weekly schedule (Monday 00:00 UTC)

**Artifacts generated**:
- Compatibility reports (JSON + Markdown)
- Build logs (on failure)
- Platform detection results

### Triggering Manually

```bash
# Via GitHub CLI
gh workflow run test-platforms.yml

# Via GitHub UI
Actions → Platform Compatibility Testing → Run workflow
```

---

## Docker Multi-Platform Builds

### Test Docker Builds

```bash
./docker/test-multiplatform.sh
```

**Platforms tested**:
- `linux/amd64` (x86_64)
- `linux/arm64` (aarch64)

**Requirements**:
- Docker with buildx support
- QEMU for cross-platform emulation

**Setup buildx**:
```bash
docker buildx create --name multiplatform-builder --use --bootstrap
docker run --privileged --rm tonistiigi/binfmt --install all
```

**Test specific platform**:
```bash
./docker/test-multiplatform.sh --platform linux/arm64
```

**Build and push**:
```bash
./docker/test-multiplatform.sh --push
```

---

## Troubleshooting

### Quick Diagnostics

```bash
# 1. Check platform
./scripts/bun/platform-detect.sh --verbose

# 2. Fix SWC issues
./scripts/bun/fix-swc-binaries.sh --verbose

# 3. Full compatibility check
./.claude/hooks/check-bun-compatibility.sh
```

### Common Solutions

| Problem | Solution |
|---------|----------|
| "Cannot find module '@next/swc-*'" | Run `./scripts/bun/fix-swc-binaries.sh` |
| "Bun not found" | Add `export PATH="$HOME/.bun/bin:$PATH"` |
| Build fails with SWC error | Delete node_modules, run `bun install` |
| pnpm symlink issues | Run fix script, restart dev server |

### Getting Help

1. **Check logs**: `test-*.log` files generated by test scripts
2. **Run diagnostics**: All scripts have `--verbose` flag
3. **Review documentation**: See `TROUBLESHOOTING_SWC.md` for detailed SWC issues
4. **Check GitHub Issues**: Search for similar platform-specific issues

---

## Best Practices

### For Developers

1. **Always run compatibility check before starting**:
   ```bash
   ./.claude/hooks/check-bun-compatibility.sh
   ```

2. **Use recommended package managers**:
   - Bun for fastest experience
   - pnpm for Node.js compatibility

3. **Test locally before CI**:
   ```bash
   ./scripts/bun/test-platform-matrix.sh --pm bun
   ```

4. **Keep scripts executable**:
   ```bash
   chmod +x scripts/bun/*.sh .claude/hooks/*.sh
   ```

### For CI/CD

1. **Use frozen lockfiles**:
   ```bash
   bun install --frozen-lockfile
   ```

2. **Cache package managers**:
   - Bun: `~/.bun/install/cache`
   - pnpm: `pnpm store path`
   - npm: `npm config get cache`

3. **Test matrix strategically**:
   - Always test primary platform (Ubuntu x64 + pnpm)
   - Test Bun on all architectures
   - Test other package managers on key platforms

### For Docker

1. **Use multi-stage builds** to reduce image size
2. **Test both platforms** before pushing to registry
3. **Use buildx** for cross-platform builds

---

## Platform Support Matrix

### Full Compatibility Matrix

| OS | Arch | Bun | pnpm | npm | yarn | Docker | Status |
|----|------|-----|------|-----|------|--------|--------|
| macOS 14 | ARM64 | ✅ | ✅ | ✅ | ✅ | N/A | Fully Tested |
| macOS 14 | x64 | ✅ | ✅ | ✅ | ✅ | N/A | Fully Tested |
| macOS 13 | ARM64 | ✅ | ✅ | ✅ | ✅ | N/A | Fully Tested |
| macOS 13 | x64 | ✅ | ✅ | ✅ | ✅ | N/A | Fully Tested |
| Ubuntu 22.04 | x64 | ✅ | ✅ | ✅ | ✅ | ✅ | Fully Tested |
| Ubuntu 22.04 | ARM64 | ✅ | ✅ | ✅ | ✅ | ✅ | Tested |
| Debian 11 | x64 | ✅ | ✅ | ✅ | ✅ | ✅ | Expected Compatible |
| Debian 11 | ARM64 | ✅ | ✅ | ✅ | ✅ | ✅ | Expected Compatible |
| Windows 11 WSL2 | x64 | ✅ | ✅ | ✅ | ✅ | ✅ | Supported |

---

*Last Updated: October 15, 2025*
*For SWC-specific issues, see: [TROUBLESHOOTING_SWC.md](./TROUBLESHOOTING_SWC.md)*
*For Bun migration details, see: [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)*

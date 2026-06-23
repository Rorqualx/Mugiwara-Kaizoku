# Developer Guide: Node.js to Bun Migration

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-10-15*

---

## Quick Start

### For New Developers

```bash
# 1. Install Bun
curl -fsSL https://bun.sh/install | bash

# 2. Reload shell
exec $SHELL

# 3. Clone and setup
git clone <repo-url> mugiwara-kaizoku
cd mugiwara-kaizoku

# 4. Install dependencies with Bun (15x faster!)
bun install

# 5. Start development server
bun --bun run dev
```

### For Existing Developers

```bash
# 1. Install Bun
curl -fsSL https://bun.sh/install | bash

# 2. Remove old dependencies
rm -rf node_modules package-lock.json

# 3. Install with Bun
bun install

# 4. Start dev server with Bun
bun --bun run dev
```

---

## Command Comparison

| Task | Node.js | Bun | Speed Improvement |
|------|---------|-----|-------------------|
| **Install dependencies** | `npm install` | `bun install` | **15x faster** (8s vs 120s) |
| **Add package** | `npm install <pkg>` | `bun add <pkg>` | **20x faster** |
| **Remove package** | `npm uninstall <pkg>` | `bun remove <pkg>` | **Instant** |
| **Update packages** | `npm update` | `bun update` | **10x faster** |
| **Dev server** | `npm run dev` | `bun --bun run dev` | **2.5x faster startup** |
| **Build** | `npm run build` | `bun run build` | **1.5x faster** |
| **Type check** | `npm run type-check` | `bun run type-check:bun` | **Same speed** |
| **Run tests** | `npm test` | `bun test` | **2x faster** |
| **Run script** | `npm run <script>` | `bun run <script>` | **Instant** |

---

## Key Differences

### 1. Lockfile

**Node.js:**
- Uses `package-lock.json` (text format, ~500KB)
- Can be edited manually (not recommended)

**Bun:**
- Uses `bun.lockb` (binary format, ~200KB)
- **Cannot be edited manually**
- **Do not commit both:** Delete `package-lock.json` after migrating

### 2. Package Cache

**Node.js:**
- Packages stored in `node_modules/`
- Duplicated across projects
- ~200-500MB per project

**Bun:**
- Global cache at `~/.bun/install/cache/`
- **Shared across all projects**
- Symlinked into `node_modules/`
- Saves gigabytes of disk space

### 3. Native TypeScript Support

**Node.js:**
- Requires `ts-node`, `tsx`, or compilation
- Extra dependencies and configuration

**Bun:**
- **Built-in TypeScript support**
- No extra tools needed
- Just run: `bun run file.ts`

### 4. Built-in Bundler

**Node.js:**
- Requires webpack, rollup, or esbuild
- Complex configuration

**Bun:**
- **Built-in bundler** (`bun build`)
- Zero configuration
- Faster than webpack

### 5. Runtime APIs

**Bun adds native APIs:**
- `Bun.serve()` - Fast HTTP server
- `Bun.write()` - Optimized file writes
- `Bun.password` - Password hashing
- `Bun.spawn()` - Process spawning

**Most Node.js APIs work:** `fs`, `path`, `http`, etc.

---

## Available Scripts

### Bun Scripts (Recommended)

```bash
# Installation
bun install                    # Install dependencies
bun install:frozen             # Install with frozen lockfile (CI)
bun add <package>              # Add package
bun remove <package>           # Remove package

# Development
bun --bun run dev              # Start dev server with Bun runtime
bun --hot run dev              # Start with hot reload (experimental)

# Building
bun run build                  # Production build
bun run build:bun              # Production build (alias)

# Testing
bun test                       # Run tests
bun test --watch               # Watch mode
bun test --coverage            # With coverage

# Type Checking
bun run type-check:bun         # Type check with Bun

# Maintenance
bun run clean:all              # Clean all artifacts
bun run reinstall:bun          # Clean and reinstall
```

### Node.js Scripts (Legacy - Still Available)

```bash
# All existing npm scripts still work
npm install
npm run dev
npm run build
npm test
```

---

## When to Use Node.js vs Bun

### ✅ Use Bun For:

- **Local development** (fastest dev server startup)
- **Package installation** (15x faster)
- **Testing** (2x faster test runs)
- **Scripts** (instant execution)
- **Docker builds** (production ready)

### ⚠️ Use Node.js For:

- **CI/CD** (until Bun workflow is validated)
- **Production** (until fully tested in staging)
- **Debugging Bun issues** (fallback option)

### 🎯 Hybrid Approach (Current)

- **Development:** Use Bun for speed
- **CI/CD:** Both Node.js and Bun (testing migration)
- **Production:** Node.js (migrating to Bun)

---

## Common Tasks

### Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1|iex"

# Homebrew (macOS)
brew install oven-sh/bun/bun

# Verify installation
bun --version  # Should show 1.3.x
```

### Update Bun

```bash
# Update to latest
bun upgrade

# Update to specific version
bun upgrade --version 1.3.0
```

### Switch Between Bun and Node.js

```bash
# Use Bun
bun install
bun --bun run dev

# Switch back to Node.js
rm -rf node_modules bun.lockb
npm install
npm run dev
```

### Regenerate Lockfile

```bash
# If bun.lockb is corrupted
rm bun.lockb
bun install

# Force clean install
bun install --force
```

### Run Prisma Commands

```bash
# Generate client
bun prisma generate

# Run migrations
bun prisma migrate deploy

# Open Studio
bun prisma studio

# All Prisma commands work with Bun!
```

---

## Troubleshooting

### Issue 1: "command not found: bun"

**Cause:** Bun not in PATH

**Solution:**
```bash
# Add to ~/.zshrc or ~/.bashrc
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Reload shell
exec $SHELL
```

### Issue 2: Module Not Found Errors

**Cause:** Missing dependencies or corrupted cache

**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules bun.lockb
bun install

# Generate Prisma client
bun prisma generate
```

### Issue 3: Port 3000 Already in Use

**Cause:** Another process using port 3000

**Solution:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or use restart command
/restart
```

### Issue 4: Slow Performance with Bun

**Cause:** Running without `--bun` flag

**Solution:**
```bash
# Incorrect (uses Node.js runtime)
bun run dev

# Correct (uses Bun runtime)
bun --bun run dev
```

### Issue 5: Docker Build Fails

**Cause:** Missing Dockerfile.bun

**Solution:**
```bash
# Use correct Dockerfile
docker build -f Dockerfile.bun -t mugiwara:bun .
```

---

## Best Practices

### 1. Always Use --bun Flag for Dev Server

```bash
# ❌ Don't
bun run dev

# ✅ Do
bun --bun run dev
```

The `--bun` flag enables Bun's native runtime optimizations.

### 2. Keep Both Lockfiles During Transition

During migration, you may need both:
- `package-lock.json` - For Node.js CI/CD
- `bun.lockb` - For Bun development

**After full migration:** Delete `package-lock.json`

### 3. Use Frozen Lockfile in CI

```bash
# In GitHub Actions, package.json scripts, etc.
bun install --frozen-lockfile
```

This ensures reproducible builds (like `npm ci`).

### 4. Clear Cache If Issues Persist

```bash
# Clear Bun cache
rm -rf ~/.bun/install/cache/*

# Reinstall
bun install
```

### 5. Report Bun-Specific Issues

If you encounter Bun-specific bugs:
1. Test with Node.js first
2. If it works with Node.js, it's a Bun issue
3. Report to: https://github.com/oven-sh/bun/issues

---

## Performance Benchmarks

Based on Mugiwara Kaizoku project:

| Metric | Node.js 21 | Bun 1.3 | Improvement |
|--------|-----------|---------|-------------|
| `npm install` / `bun install` | 120s | 8s | **15x faster** |
| Dev server startup | 5s | 2s | **2.5x faster** |
| Hot module replacement | 1000ms | 200ms | **5x faster** |
| Production build | 22s | 15s | **1.5x faster** |
| Test suite | 45s | 22s | **2x faster** |

---

## Migration Checklist

### For Individual Developers

- [ ] Install Bun: `curl -fsSL https://bun.sh/install | bash`
- [ ] Verify installation: `bun --version`
- [ ] Remove old dependencies: `rm -rf node_modules`
- [ ] Install with Bun: `bun install`
- [ ] Test dev server: `bun --bun run dev`
- [ ] Verify all features work
- [ ] Report any issues to team

### For Team Lead

- [ ] All developers have Bun installed
- [ ] CI/CD updated with Bun workflow
- [ ] Documentation updated
- [ ] Staging environment tested
- [ ] Rollback plan documented
- [ ] Team trained on Bun usage

---

## Getting Help

### Internal Resources

- **Migration Plan:** `docs/migration/BUN_MIGRATION_IMPLEMENTATION_PLAN.md`
- **Analysis:** `docs/migration/BUN_MIGRATION_ANALYSIS.md`
- **Addendum:** `docs/migration/BUN_MIGRATION_ADDENDUM.md`
- **Team Slack:** `#bun-migration` channel

### External Resources

- **Bun Documentation:** https://bun.sh/docs
- **Bun Discord:** https://bun.sh/discord
- **GitHub Issues:** https://github.com/oven-sh/bun/issues
- **Next.js + Bun Guide:** https://bun.sh/guides/ecosystem/nextjs

---

## FAQ

**Q: Will Bun break my workflow?**
A: No. All existing Node.js scripts still work. Bun is additive.

**Q: Can I use Bun for production?**
A: Yes! Mugiwara is configured with `output: 'standalone'` which works perfectly with Bun.

**Q: What if I encounter a bug?**
A: Fall back to Node.js immediately, document the issue, report to team.

**Q: Do I need to learn new commands?**
A: No. Bun commands are nearly identical to npm: `bun install`, `bun add`, `bun run`.

**Q: How do I uninstall Bun?**
A: `rm -rf ~/.bun`

**Q: Does Bun work with Prisma?**
A: Yes! All Prisma commands work: `bun prisma generate`, `bun prisma migrate deploy`, etc.

---

## Platform Compatibility

### Overview

Mugiwara Kaizoku with Bun 1.3 has been tested across multiple platforms and architectures. This section covers platform-specific setup and known issues.

### Supported Platforms

| Platform | Architecture | Status | Notes |
|----------|-------------|--------|-------|
| macOS 14 | ARM64 | ✅ Fully Supported | Apple Silicon |
| macOS 14 | x86_64 | ✅ Fully Supported | Intel Mac |
| macOS 13 | ARM64/x64 | ✅ Fully Supported | Ventura |
| Ubuntu 22.04+ | x64 | ✅ Fully Supported | Recommended for CI/CD |
| Ubuntu 22.04+ | ARM64 | ✅ Supported | |
| Windows 11 | x64 (WSL2) | ✅ Supported | WSL2 required |

### Platform Detection

Before starting development, check your platform:

```bash
./scripts/bun/platform-detect.sh --verbose
```

This detects:
- Operating system and version
- System architecture (x86_64, ARM64)
- Bun architecture (may differ!)
- Required Next.js SWC binary
- Rosetta 2 status (macOS)
- Package manager

### macOS-Specific Setup

#### Apple Silicon (ARM64)

**Standard setup:**
```bash
# Install Bun (ARM64 native)
curl -fsSL https://bun.sh/install | bash

# Verify architecture
file ~/.bun/bin/bun  # Should show arm64

# Install and run
bun install
bun --bun run dev
```

**Rosetta 2 Warning:**

If your Terminal runs under Rosetta 2, you may encounter SWC binary issues:

```bash
# Check if running under Rosetta
arch  # If shows "i386" or "x86_64", you're in Rosetta mode
```

**Fix**:
1. Quit Terminal
2. Get Info on Terminal.app
3. **Uncheck** "Open using Rosetta"
4. Restart Terminal
5. Verify: `arch` should show `arm64`

**Auto-fix for Rosetta + Bun:**
```bash
./.claude/hooks/check-bun-compatibility.sh
```

#### Intel Mac (x86_64)

Setup is identical to ARM64:

```bash
curl -fsSL https://bun.sh/install | bash
bun install
bun --bun run dev
```

**Java 21 (for Suwayomi):**

If using Homebrew Java:
```bash
export PATH="/usr/local/opt/openjdk@21/bin:$PATH"
export JAVA_HOME="/usr/local/opt/openjdk@21"
```

This is automatically set by dev scripts.

### Linux-Specific Setup

#### Ubuntu/Debian

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH (if needed)
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Install dependencies
sudo apt-get update
sudo apt-get install -y build-essential

# Install and run
bun install
bun --bun run dev
```

#### ARM64 (aarch64)

Same as x86_64, but Bun will install ARM64 binary automatically:

```bash
curl -fsSL https://bun.sh/install | bash
file ~/.bun/bin/bun  # Should show aarch64
```

### Windows-Specific Setup (WSL2)

Bun requires WSL2 on Windows.

#### Install WSL2

```powershell
# In PowerShell (Admin)
wsl --install -d Ubuntu-22.04
```

#### Inside WSL2

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Clone project IN WSL filesystem
cd ~
git clone <repo-url>
cd mugiwara-kaizoku

# Install and run
bun install
bun --bun run dev
```

**Important**: Keep project in WSL filesystem (`/home/username/`), not Windows filesystem (`/mnt/c/`), for better performance.

### Next.js SWC Binary Issues

The most common platform issue is Next.js SWC (Speedy Web Compiler) binary compatibility.

#### What is SWC?

SWC is a Rust-based compiler used by Next.js. It's a native binary that varies by platform:

| Platform | SWC Package |
|----------|-------------|
| macOS ARM64 | `@next/swc-darwin-arm64` |
| macOS x64 | `@next/swc-darwin-x64` |
| Linux ARM64 | `@next/swc-linux-arm64-gnu` |
| Linux x64 | `@next/swc-linux-x64-gnu` |
| Windows x64 | `@next/swc-win32-x64-msvc` |

#### Common SWC Errors

**Error**: "Cannot find module '@next/swc-darwin-arm64'"

**Quick Fix**:
```bash
./scripts/bun/fix-swc-binaries.sh
```

**What it does**:
1. Detects your platform
2. Determines required SWC binary
3. Installs missing binary
4. Fixes broken symlinks (bun run virtual store)
5. Validates installation

#### SWC Troubleshooting Tools

```bash
# 1. Detect platform and required SWC binary
./scripts/bun/platform-detect.sh --verbose

# 2. Fix SWC binary issues
./scripts/bun/fix-swc-binaries.sh --verbose

# 3. Full compatibility check
./.claude/hooks/check-bun-compatibility.sh
```

For detailed SWC troubleshooting, see: [TROUBLESHOOTING_SWC.md](./TROUBLESHOOTING_SWC.md)

### Testing Platform Compatibility

#### Local Testing

Test across all installed package managers:

```bash
./scripts/bun/test-platform-matrix.sh
```

**Test specific package manager**:
```bash
./scripts/bun/test-platform-matrix.sh --pm pnpm
```

**Quick test** (skip build):
```bash
./scripts/bun/test-platform-matrix.sh --skip-build
```

#### Docker Multi-Platform Testing

Test Docker builds for different architectures:

```bash
# Prerequisites
docker buildx create --name multiplatform-builder --use --bootstrap
docker run --privileged --rm tonistiigi/binfmt --install all

# Test all platforms
./docker/test-multiplatform.sh

# Test specific platform
./docker/test-multiplatform.sh --platform linux/arm64
```

### CI/CD Platform Testing

GitHub Actions workflow automatically tests across:
- Ubuntu 22.04 (x64) with pnpm, npm, yarn, bun
- macOS 14 (ARM64) with pnpm, npm, yarn, bun
- macOS 13 (x64) with pnpm, bun

**Trigger manually**:
```bash
gh workflow run test-platforms.yml
```

### Compatibility Checklist

Before starting development:

- [ ] Bun installed: `bun --version` shows 1.3.0+
- [ ] Correct architecture: `file $(which bun)` matches system
- [ ] Platform detected: `./scripts/bun/platform-detect.sh`
- [ ] SWC binaries valid: `./scripts/bun/fix-swc-binaries.sh --dry-run`
- [ ] Full compatibility: `./.claude/hooks/check-bun-compatibility.sh`

### Platform-Specific Known Issues

#### macOS ARM64 + Rosetta 2 + pnpm

**Issue**: Broken SWC binary symlinks in bun run virtual store.

**Auto-fix**: `./.claude/hooks/check-bun-compatibility.sh`

#### Linux ARM64 + Docker

**Issue**: Cross-platform Docker builds require QEMU.

**Fix**:
```bash
docker run --privileged --rm tonistiigi/binfmt --install all
```

#### Windows WSL2

**Issue**: Slow performance with cross-filesystem operations.

**Fix**: Keep project in WSL filesystem (`~/projects/`), not `/mnt/c/`

### Getting Help

For platform-specific issues:

1. **Run diagnostics**:
   ```bash
   ./scripts/bun/platform-detect.sh --verbose > platform-info.txt
   ```

2. **Try auto-fix**:
   ```bash
   ./scripts/bun/fix-swc-binaries.sh --verbose
   ```

3. **Check documentation**:
   - [PLATFORM_COMPATIBILITY.md](./PLATFORM_COMPATIBILITY.md) - Complete compatibility guide
   - [TROUBLESHOOTING_SWC.md](./TROUBLESHOOTING_SWC.md) - SWC-specific issues

4. **Report issue** with platform-info.txt attached

---

*Last updated: October 15, 2025*
*Questions? Ask in #bun-migration Slack channel*

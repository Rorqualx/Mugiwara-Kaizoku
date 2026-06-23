# Suwayomi Java 21 Setup Guide

## Overview

Suwayomi requires **Java 21 or higher** to run. Previous versions (Java 11, Java 17) are no longer supported due to the Suwayomi server JAR being compiled with Java 21.

## Installation Instructions

### macOS (Homebrew)

1. Install Homebrew if not already installed:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. Install OpenJDK 21:
```bash
brew install openjdk@21
```

3. Add Java 21 to your PATH (for your shell profile):

For Intel Macs (add to `~/.zshrc` or `~/.bash_profile`):
```bash
export PATH="/usr/local/opt/openjdk@21/bin:$PATH"
export JAVA_HOME="/usr/local/opt/openjdk@21"
```

For Apple Silicon Macs (add to `~/.zshrc` or `~/.bash_profile`):
```bash
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
```

4. Reload your shell configuration:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

### Windows

1. Download Eclipse Temurin 21 (OpenJDK) from: https://adoptium.net/
2. Run the installer and follow the instructions
3. The installer will automatically add Java to your PATH
4. Restart your terminal/command prompt

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install openjdk-21-jre-headless
```

### Linux (RHEL/CentOS/Fedora)

```bash
sudo dnf install java-21-openjdk
```

### Docker

The project's Dockerfile already includes Java 21 installation:
```dockerfile
apt-get install -y temurin-21-jre
```

## Verification

After installation, verify Java 21 is available:

```bash
java -version
```

You should see output similar to:
```
openjdk version "21.0.0" 2023-09-19
OpenJDK Runtime Environment (build 21.0.0+35-2513)
OpenJDK 64-Bit Server VM (build 21.0.0+35-2513, mixed mode, sharing)
```

## Production Setup

In production the app is started with `bun run start:prod` (`bun src/server/index.ts`); in the Docker image Java 21 (`temurin-21-jre`) is already on the PATH. For local production runs, ensure a Java 21 JRE is on your PATH (see the install steps above).

### Manual PATH Configuration

If the automatic detection doesn't work, you can manually set the Java path before starting the application:

```bash
# Intel Mac
export PATH="/usr/local/opt/openjdk@21/bin:$PATH"
export JAVA_HOME="/usr/local/opt/openjdk@21"

# Apple Silicon Mac
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"

# Then start the application
bun run start:prod
```

## Troubleshooting

### "Java 11 is installed, but Suwayomi requires Java 21 or higher"

This error occurs when the system is using an older Java version. Solutions:

1. **Check which Java is being used:**
   ```bash
   which java
   java -version
   ```

2. **If Java 21 is installed but not being used:**
   - Ensure Java 21 is first in your PATH
   - Check if JAVA_HOME is pointing to the correct version
   - On macOS with Homebrew, Java is installed as "keg-only" and needs manual PATH configuration

3. **Multiple Java versions installed:**
   - Use `jenv` or similar tools to manage multiple Java versions
   - Or manually set the PATH to prioritize Java 21

### Homebrew "keg-only" Installation

Homebrew installs OpenJDK as "keg-only", meaning it's not automatically linked to `/usr/local/bin`. This is why you need to manually add it to your PATH.

The application's scripts handle this automatically by checking common Homebrew installation paths:
- Intel Macs: `/usr/local/opt/openjdk@21/bin/java`
- Apple Silicon: `/opt/homebrew/opt/openjdk@21/bin/java`

## Related Files

- `/src/server/services/suwayomi/utils.ts` - Java version detection logic
- `/scripts/install-java-21.sh` - Automated Java 21 installation script
- `scripts/install-java-21.sh` - Installs/locates a Java 21 JRE
- Production start: `bun run start:prod` (`bun src/server/index.ts`)
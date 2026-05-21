# Java Setup

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Java Setup

---
# Java Setup Guide for Mugiwara-Kaizoku

This guide provides detailed instructions for installing and configuring Java for Suwayomi integration in Mugiwara-Kaizoku.

## Overview

Suwayomi is a manga server that requires Java 11 or higher to run. The Mugiwara-Kaizoku build system automatically detects Java installation and version during setup. If Java is missing or the version is too old, Suwayomi will be disabled, but you can still use other features of the application.

## Checking Your Java Version

Before installing, check if you already have Java installed:

```bash
java -version
```

You should see output like:
- `openjdk version "11.0.27"` (Java 11 or higher - Good!)
- `java version "1.8.0_25"` (Java 8 - Too old, needs upgrade)
- `command not found` (Java not installed)

## Installation Instructions by Platform

### macOS

#### Option 1: Homebrew (Recommended)

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install OpenJDK 11
brew install openjdk@11

# Create symlink for system Java wrappers (requires admin password)
sudo ln -sfn /usr/local/opt/openjdk@11/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-11.jdk

# Add Java to your PATH (for zsh - default on macOS)
echo 'export PATH="/usr/local/opt/openjdk@11/bin:$PATH"' >> ~/.zshrc
echo 'export JAVA_HOME="/usr/local/opt/openjdk@11"' >> ~/.zshrc
source ~/.zshrc

# For bash users
echo 'export PATH="/usr/local/opt/openjdk@11/bin:$PATH"' >> ~/.bash_profile
echo 'export JAVA_HOME="/usr/local/opt/openjdk@11"' >> ~/.bash_profile
source ~/.bash_profile
```

#### Option 2: SDKMAN

```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Install Java 11
sdk install java 11.0.21-tem

# Set as default
sdk default java 11.0.21-tem
```

### Windows

#### Option 1: Windows Package Manager (winget)

```powershell
# Open PowerShell as Administrator
winget install EclipseAdoptium.Temurin.11.JRE
```

#### Option 2: Chocolatey

```powershell
# Open PowerShell as Administrator
# Install Chocolatey if not already installed
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Java 11
choco install temurin11 -y
```

#### Option 3: Manual Installation

1. Visit [Adoptium Downloads](https://adoptium.net/temurin/releases/?version=11)
2. Download the Windows MSI installer for Java 11
3. Run the installer with default settings
4. Restart your terminal/command prompt

### Linux

#### Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install OpenJDK 11
sudo apt install openjdk-11-jre-headless -y

# Set Java 11 as default (if multiple versions installed)
sudo update-alternatives --config java
```

#### Fedora/RHEL/CentOS

```bash
# Install OpenJDK 11
sudo dnf install java-11-openjdk-headless -y

# Set Java 11 as default (if multiple versions installed)
sudo alternatives --config java
```

#### Arch Linux

```bash
# Install OpenJDK 11
sudo pacman -S jre11-openjdk-headless

# Set Java 11 as default (if multiple versions installed)
sudo archlinux-java set java-11-openjdk
```

#### Universal Linux (Using SDKMAN)

```bash
# Install SDKMAN
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"

# Install Java 11
sdk install java 11.0.21-tem

# Set as default
sdk default java 11.0.21-tem
```

### Docker

If you're running Mugiwara-Kaizoku in Docker, Java is automatically included in the container. No manual installation is required.

## Troubleshooting

### Java Version Still Shows Old Version

If `java -version` still shows an old version after installation:

1. **Close and reopen your terminal** - PATH changes require a new terminal session

2. **Check your PATH** - Ensure Java 11 is in your PATH:
   ```bash
   echo $PATH
   # Should include the Java 11 bin directory
   ```

3. **Check JAVA_HOME**:
   ```bash
   echo $JAVA_HOME
   # Should point to Java 11 installation
   ```

4. **For macOS/Linux** - Manually source your profile:
   ```bash
   source ~/.zshrc    # for zsh
   source ~/.bashrc   # for bash
   ```

5. **Multiple Java Versions** - If you have multiple Java versions:
   - macOS: Use `java_home` command
     ```bash
     /usr/libexec/java_home -V  # List all versions
     export JAVA_HOME=$(/usr/libexec/java_home -v 11)  # Use Java 11
     ```
   - Linux: Use `update-alternatives` or `alternatives` command
   - Windows: Check System Environment Variables

### Build Script Still Can't Find Java

If the build script can't find Java even after installation:

1. **Verify Java is accessible**:
   ```bash
   which java
   /usr/local/opt/openjdk@11/bin/java -version  # Direct path test
   ```

2. **Update build script** (already done automatically):
   The build script now includes Java 11 path detection for macOS Homebrew installations.

3. **Manual Suwayomi installation**:
   ```bash
   # Set Java path and run Suwayomi installer
   PATH="/usr/local/opt/openjdk@11/bin:$PATH" node scripts/install-suwayomi.mjs
   ```

### Permission Denied Errors

If you get permission errors:

1. **macOS symlink** - The `sudo ln -sfn` command requires administrator password
2. **Linux package installation** - Use `sudo` for package managers
3. **Windows** - Run PowerShell as Administrator

## Verifying Suwayomi Installation

After installing Java, verify Suwayomi can be installed:

```bash
# Run the build command
pnpm build:clean

# Or manually test Suwayomi installation
node scripts/install-suwayomi.mjs
```

You should see:
```
✓ Java is installed: 11.0.27 (Major version: 11)
✓ Java 11.0.27 (Major: 11) meets the requirements for Suwayomi.
Suwayomi installation complete!
```

## Disabling Suwayomi

If you don't want to use Suwayomi, you can disable it:

1. **Environment variable**:
   ```bash
   export DISABLE_SUWAYOMI=true
   pnpm build:clean
   ```

2. **In application settings** - After starting the app, go to Settings → Integrations → Suwayomi and disable it

## Next Steps

After successfully installing Java:

1. Run `pnpm build:clean` to complete the setup with Suwayomi
2. Start the development server with `pnpm dev`
3. Navigate to Settings → Integrations → Suwayomi to configure the integration
4. See [Suwayomi Setup Guide](./suwayomi-setup.md) for detailed configuration options

## Additional Resources

- [Suwayomi Documentation](https://github.com/Suwayomi/Suwayomi-Server)
- [OpenJDK Documentation](https://openjdk.org/)
- [SDKMAN Documentation](https://sdkman.io/)
- [Adoptium (formerly AdoptOpenJDK)](https://adoptium.net/)
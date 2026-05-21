# Suwayomi Java Requirements

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Suwayomi Java Requirements

---
# Suwayomi Java Requirements

This document outlines how Mugiwara-Kaizoku handles Java requirements for the Suwayomi integration.

## Overview

Suwayomi is a manga reader server that requires Java 11 or higher to run. The application includes automatic detection, notification, and installation mechanisms to ensure this requirement is met.

## Requirement Details

- **Minimum Java Version**: 11
- **Recommended Java Version**: 17 (OpenJDK)
- **Check Command**: `java -version`
- **Environment Variable**: `DISABLE_SUWAYOMI=true/false`

## Automatic Installation Process

The application includes a robust Java installation script that:

1. **Detects OS Type**: Works on macOS, Linux, and provides instructions for Windows
2. **Checks Current Java Version**: Parses and verifies the Java version
3. **Installs Java if Needed**: Uses appropriate package managers (Homebrew for macOS, apt/dnf/pacman for Linux)
4. **Updates PATH**: Ensures Java is accessible in the current and future terminal sessions
5. **Sets Environment Variables**: Updates the .env file to enable/disable Suwayomi based on Java status

## Version Detection Logic

The Java version detection handles multiple version formats:

- **Modern Format**: "11.0.2", "17.0.1"
- **Legacy Format**: "1.8.0_25" (where 8 is the actual Java version)
- **Output Variations**: Handles version info in both stdout and stderr

## Handling Old Java Versions

If Java is detected but the version is below 11:

1. The user is notified via console output
2. The application sets `DISABLE_SUWAYOMI=true` in the .env file
3. The Suwayomi integration is automatically disabled in the UI
4. Clear instructions are provided for upgrading Java

## User Interface

The application provides clear UI feedback in the Suwayomi integration panel:

- **Warning Banner**: Shows when Java requirements aren't met
- **Disabled Controls**: Prevents enabling Suwayomi when Java is incompatible
- **Installation Instructions**: Directs users to run `pnpm check-java` or refer to docs

## Manual Installation

For users who prefer manual installation, detailed instructions are available in:
- The console output when the Java check fails
- The documentation at `docs/java-setup.md`

## Troubleshooting

Common issues and their solutions:

1. **Java Not Found**: Ensure Java is installed and in PATH
2. **Wrong Java Version**: Use the installation script to upgrade
3. **Path Issues**: Restart terminal after installation
4. **Permission Issues**: Some installations may require sudo access

## Useful Commands

```bash
# Check Java installation
pnpm check-java

# Install Suwayomi (will verify Java first)
pnpm install-suwayomi

# Manual Java version check
java -version
```

## Environment Variables

- `DISABLE_SUWAYOMI=true`: Completely disables Suwayomi integration
- `DOCKER=true`: Skips Java checks when running in Docker environments

## Technical Implementation

- **Version Parsing**: `/scripts/Installation/install-java.mjs` contains the version parsing logic
- **UI Integration**: `/src/hooks/useJavaRequirements.ts` provides React components with Java status
- **Suwayomi Component**: `/src/components/settings/suwayomi/SuwayomiIntegration.tsx` uses the hook to conditionally render UI

## Continuous Integration

In CI environments:
- Java checks are automatically performed during the build process
- The application will build successfully even without Java
- Suwayomi features will be automatically disabled if Java requirements aren't met
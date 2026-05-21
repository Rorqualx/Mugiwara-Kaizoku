# Package Management

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Package Management

---
# Package Management in Kaizoku

Kaizoku strictly uses [pnpm](https://pnpm.io/) as its package manager. This document explains the package management tools and scripts available in the project.

## Package Manager Enforcement

The project includes a script that enforces the use of pnpm:

- `scripts/check-package-manager.js` - Runs automatically during installation to ensure pnpm is being used

## Package Update Scripts

Kaizoku includes several scripts to help manage dependencies and keep them up-to-date:

### All-in-One Update Helper

- `pnpm update-all` - Interactive script that runs all compatibility checks and update scripts in sequence

### Individual Scripts

- `pnpm check-deps` - Checks for available updates to all dependencies
- `pnpm update-deps` - Updates all dependencies to their latest versions
- `pnpm update-safe-deps` - Updates only dependencies that are considered safe to update
- `pnpm check-lucia` - Checks compatibility between Lucia Auth adapter and Prisma
- `pnpm check-next-react` - Checks compatibility between Next.js, React, and related packages
- `pnpm check-deprecated` - Identifies deprecated packages and suggests alternatives
- `pnpm check-package-compatibility` - Runs all compatibility checks and generates a detailed report

### Automated Compatibility Check

The project includes an automated package compatibility check that runs during the build process:

- **Build Integration**: The compatibility check runs automatically as part of the `prebuild` script
- **Configurable**: Settings can be adjusted in `package-compatibility-config.json`
- **Detailed Reports**: Generates a JSON report with detailed information about compatibility issues
- **Build Protection**: Can be configured to fail the build if critical issues are found

The automated check helps prevent builds with incompatible package versions, ensuring that dependency issues are addressed before deployment.

## Compatibility Issues

The project has several known compatibility issues that these scripts help identify and resolve:

1. **Lucia Auth and Prisma**: The `@lucia-auth/adapter-prisma` package expects Prisma v4.2.0 or v5.0.0, but the project uses v6.1.0.

2. **cookies-next and Next.js**: The `cookies-next` package expects Next.js ≥15.0.0, but the project uses v14.1.0.

3. **react-server-dom-webpack and React**: The `react-server-dom-webpack` package expects React v19.0.0, but the project uses v18.3.1.

4. **Deprecated packages**: Several packages and subdependencies are deprecated and should be updated.

## Using the Package Management Tools

### Automated Compatibility Check

The automated compatibility check runs during the build process, but you can also run it manually:

```bash
pnpm check-package-compatibility
```

This will:
1. Run all compatibility checks
2. Generate a detailed report in `package-compatibility-report.json`
3. Display a summary of any issues found
4. Exit with an error code if critical issues are found (based on configuration)

You can configure the behavior of the compatibility check by editing `package-compatibility-config.json`:

```json
{
  "failOnCriticalIssues": true,
  "autoApplySafeFixes": false,
  "criticalIssueTypes": ["incompatible-lucia", "incompatible-next-react"],
  "outputReportPath": "package-compatibility-report.json"
}
```

### Comprehensive Update Check

To run a comprehensive check of all dependencies and get interactive prompts for updates:

```bash
pnpm update-all
```

This script will:
1. Check for deprecated packages
2. Check Lucia Auth adapter compatibility
3. Check Next.js and React compatibility
4. Check for available updates
5. Prompt you to update safe packages
6. Prompt you to update all packages

### Targeted Checks

To check specific compatibility issues:

```bash
# Check Lucia Auth adapter compatibility with Prisma
pnpm check-lucia

# Check Next.js and React compatibility issues
pnpm check-next-react

# Check for deprecated packages
pnpm check-deprecated
```

### Updating Packages

To update packages:

```bash
# Update only safe dependencies
pnpm update-safe-deps

# Update all dependencies (use with caution)
pnpm update-deps
```

## Best Practices

1. **Always use pnpm**: Never use npm or yarn for this project
2. **Run checks before updates**: Always run compatibility checks before updating packages
3. **Test after updates**: Always test the application after updating packages
4. **Prefer safe updates**: Prefer updating safe packages first before attempting more risky updates
5. **Update in stages**: Update packages in small batches rather than all at once
6. **Review compatibility reports**: Check the generated compatibility reports to understand dependency issues
7. **Keep configuration updated**: Adjust the compatibility check configuration as project requirements change

# Admin Setup Options

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Admin Setup Options

---
# Admin Setup Options

This document outlines the different methods available for creating an admin user in Kaizoku, especially useful if you encounter issues with the default setup process.

## Browser Extension Issues

Some users may experience issues with browser extensions interfering with the admin setup process. This can manifest as:

- Missing stylesheets errors
- Quirks Mode rendering
- Autocomplete attribute warnings
- Other unexpected behavior

We've implemented several solutions to address these issues:

### Content Security Policy (CSP)

The application now uses a Content Security Policy to block unwanted resources from being loaded, including those from browser extensions. This helps prevent extensions from interfering with the admin setup process.

To test if the CSP is working correctly, you can visit:

- **URL**: `/csp-test.html`

This page will check if any extension stylesheets are being loaded and report the results. If the CSP is working correctly, it should show a success message. If not, it will suggest alternative setup methods.

## Option 1: Standard Setup Page (Default)

The standard setup page is available at `/setup` when no users exist in the database. This is the recommended approach for most users.

- **URL**: `/setup`
- **Features**:
  - User-friendly interface
  - Guided setup process
  - Automatic redirection to login page after completion

## Option 2: Standalone HTML Form

If you're experiencing issues with the standard setup page (such as browser extension conflicts or stylesheet errors), you can use the standalone HTML form.

- **URL**: `/admin-setup.html`
- **Features**:
  - Minimal dependencies
  - No React components
  - Works with JavaScript disabled
  - Less likely to be affected by browser extensions

## Option 3: Command-Line Tool

For server administrators or when web interfaces are not working, you can use the command-line tool to create an admin user directly.

- **Command**: `npm run create-admin -- --username admin --email admin@example.com --password yourpassword`
- **Features**:
  - Bypasses the browser entirely
  - Direct database access
  - Useful for automation or scripting
  - Most reliable method

### Command-Line Options

```bash
# Basic usage
npm run create-admin -- --username admin --email admin@example.com --password yourpassword

# Short form
npm run create-admin -- -u admin -e admin@example.com -p yourpassword

# Force creation even if users already exist
npm run create-admin -- -u admin -e admin@example.com -p yourpassword --force

# Get help
npm run create-admin -- --help
```

## Troubleshooting

### Browser Extension Issues

If you're experiencing issues with the standard setup page, try:

1. Disabling browser extensions, especially ad blockers or privacy tools
2. Using the standalone HTML form at `/admin-setup.html`
3. Using a different browser
4. Using the command-line tool as a last resort

### Debug Tools

We've added several debug tools to help diagnose issues with the admin creation process:

1. **Debug Admin Page**: A dedicated debug page at `/debug-admin.html` that provides:
   - A simplified admin creation form
   - Real-time debug logs viewer
   - Testing tools for CSP, API, and database connection

2. **Debug Logs API**: Access detailed logs at `/api/debug-logs` to see what's happening during the admin creation process.

3. **CSP Test Page**: Test if Content Security Policy is working correctly at `/csp-test.html`.

These tools can help identify where the admin creation process is failing, whether it's at the form validation, API, or database level.

### Form Submission Errors

If you receive errors when submitting the form:

1. Check that your password is at least 6 characters
2. Ensure your email is in a valid format
3. Make sure the username is at least 3 characters
4. Verify that the username and email are not already in use

### Database Connection Issues

If you're experiencing database connection issues:

1. Verify that your database is running and accessible
2. Check the database connection settings in your environment variables
3. Look at the server logs for more detailed error messages

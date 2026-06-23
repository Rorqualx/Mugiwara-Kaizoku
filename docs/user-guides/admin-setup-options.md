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

## Option 2: Command-Line Tool

For server administrators or when web interfaces are not working, you can use the command-line tool to create an admin user directly.

Two scripts are available under `scripts/utilities/`:

- **`create-admin-simple.js`** — non-interactive; creates an admin with hardcoded defaults (`admin` / `admin@kaizoku.local` / `password`). Run once on a fresh database, then change the password immediately after login.
- **`create-admin.js`** — interactive; prompts you for username, email, and password at the terminal.

- **Features**:
  - Bypasses the browser entirely
  - Direct database access
  - Most reliable method when the web setup page is unavailable

### Command-Line Usage

```bash
# Non-interactive (hardcoded defaults — change password after first login)
node scripts/utilities/create-admin-simple.js

# Interactive (prompts for username, email, password)
node scripts/utilities/create-admin.js
```

## Troubleshooting

### Browser Extension Issues

If you're experiencing issues with the standard setup page, try:

1. Disabling browser extensions, especially ad blockers or privacy tools
2. Using a different browser
3. Using the command-line tool as a last resort

### Debug Tools

- **CSP Test Page**: Test if Content Security Policy is working correctly at `/csp-test.html`.

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

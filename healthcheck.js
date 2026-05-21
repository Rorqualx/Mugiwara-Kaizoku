// healthcheck.js
// Docker container health check script
//
// This script is called by Docker's HEALTHCHECK directive to verify
// the application is responsive and healthy.
//
// Exit codes:
// - 0: Healthy
// - 1: Unhealthy
//
// Usage in Dockerfile:
// HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
//     CMD bun /app/healthcheck.js || exit 1

async function healthCheck() {
  try {
    const port = process.env.PORT || 3000;
    const url = `http://localhost:${port}/api/health`;

    // Fetch health endpoint with 2 second timeout
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2000)
    });

    if (response.ok) {
      // Health check passed - exit with success code
      process.exit(0);
    } else {
      // Health check failed - exit with error code
      process.exit(1);
    }
  } catch (error) {
    // Health check exception - exit with error code
    process.exit(1);
  }
}

healthCheck();

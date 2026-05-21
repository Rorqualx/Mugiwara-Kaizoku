#!/usr/bin/env node
/**
 * Production Server Lifecycle Wrapper
 * 
 * This wrapper ensures proper lifecycle management for the production server,
 * especially for managing child processes like Suwayomi that need to be
 * terminated when the main application exits.
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track child processes
const childProcesses = [];

// Cleanup function
function cleanup(signal) {
  console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
  
  // Kill all tracked child processes
  childProcesses.forEach(child => {
    if (child && !child.killed) {
      console.log(`Stopping child process PID: ${child.pid}`);
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch (error) {
        console.error(`Failed to stop child process ${child.pid}:`, error.message);
      }
    }
  });
  
  // Kill any Suwayomi processes that might be running
  try {
    console.log('Checking for Suwayomi processes...');
    execSync('pkill -f "Suwayomi-Server.jar" 2>/dev/null || true');
  } catch (error) {
    // Ignore errors from pkill
  }
  
  // Give processes time to cleanup
  setTimeout(() => {
    console.log('Shutdown complete');
    process.exit(0);
  }, 2000);
}

// Register cleanup handlers
process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGHUP', () => cleanup('SIGHUP'));
process.on('exit', () => {
  // Final cleanup on exit
  childProcesses.forEach(child => {
    if (child && !child.killed) {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch (error) {
        // Process might already be dead
      }
    }
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  cleanup('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  cleanup('unhandledRejection');
});

// Start the main server
console.log('🚀 Starting production server with lifecycle management...');

// Get the server wrapper path (the existing one that handles env loading)
const serverWrapperPath = path.join(process.cwd(), '.next/standalone/server-wrapper.js');
const serverPath = path.join(process.cwd(), '.next/standalone/server.js');

// Check which file to run
let targetFile;
if (fs.existsSync(serverWrapperPath)) {
  targetFile = serverWrapperPath;
  console.log('Using server-wrapper.js for environment loading...');
} else if (fs.existsSync(serverPath)) {
  targetFile = serverPath;
  console.log('Using server.js directly...');
} else {
  console.error('Neither server-wrapper.js nor server.js found in .next/standalone/');
  process.exit(1);
}

// Spawn the server as a child process
const serverProcess = spawn('node', [targetFile], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  },
  cwd: path.dirname(targetFile)
});

// Track the server process
childProcesses.push(serverProcess);

// Handle server process events
serverProcess.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
  if (signal) {
    console.log(`Server process exited due to signal: ${signal}`);
  } else if (code !== 0) {
    console.error(`Server process exited with code: ${code}`);
  } else {
    console.log('Server process exited normally');
  }
  
  // If server exits unexpectedly, cleanup and exit
  if (!signal) {
    cleanup('server-exit');
  }
});

console.log(`Server lifecycle wrapper started, managing process PID: ${serverProcess.pid}`);
console.log('Press Ctrl+C to stop the server and all child processes');
// Load environment variables for production builds
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Preserve NODE_ENV if already set
const originalNodeEnv = process.env.NODE_ENV;

// Determine environment file to load
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env';

// Try to load from project root
const envPath = join(process.cwd(), envFile);
if (existsSync(envPath)) {
  console.log(`Loading environment from ${envFile}...`);
  dotenv.config({ path: envPath });
}

// Also load default .env if production file doesn't exist
if (process.env.NODE_ENV === 'production' && !existsSync(envPath)) {
  const defaultEnvPath = join(process.cwd(), '.env');
  if (existsSync(defaultEnvPath)) {
    console.log('Loading environment from .env...');
    dotenv.config({ path: defaultEnvPath });
  }
}

// Restore original NODE_ENV if it was set (production scripts force this)
if (originalNodeEnv) {
  process.env.NODE_ENV = originalNodeEnv;
}

// Set default values for critical variables
process.env.KAIZOKU_LOG_PATH = process.env.KAIZOKU_LOG_PATH || './logs';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('Environment variables loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  KAIZOKU_LOG_PATH: process.env.KAIZOKU_LOG_PATH,
  DATABASE_URL: process.env.DATABASE_URL ? '[SET]' : '[NOT SET]',
  AUTH_SECRET: process.env.AUTH_SECRET ? '[SET]' : '[NOT SET]',
});

// Import and start the Next.js server
import('./server.js');

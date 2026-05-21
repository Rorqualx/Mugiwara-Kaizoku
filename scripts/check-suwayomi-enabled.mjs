#!/usr/bin/env node

/**
 * Helper script to check if Suwayomi is enabled in the application settings
 * 
 * This script queries the database directly to check the suwayomiEnabled setting
 * Returns exit code 0 if enabled, 1 if disabled
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function checkSuwayomiEnabled() {
  try {
    // Query the settings table for suwayomiEnabled
    const settings = await prisma.settings.findFirst({
      where: {
        key: 'suwayomiEnabled'
      }
    });

    if (settings && settings.value === 'true') {
      console.log('enabled');
      process.exit(0);
    } else {
      console.log('disabled');
      process.exit(1);
    }
  } catch (error) {
    // If we can't connect to the database or the table doesn't exist yet,
    // assume Suwayomi is disabled
    console.log('disabled');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkSuwayomiEnabled();

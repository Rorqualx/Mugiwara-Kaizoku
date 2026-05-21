#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function enableSuwayomi() {
  try {
    console.log('Enabling Suwayomi integration...');

    // Check if config exists
    const existingEnabledConfig = await prisma.config.findFirst({
      where: { key: 'suwayomi.enabled' }
    });

    if (existingEnabledConfig) {
      // Update existing config
      await prisma.config.update({
        where: { id: existingEnabledConfig.id },
        data: { value: 'true' }
      });
      console.log('Updated existing suwayomi.enabled to true');
    } else {
      // Create new config
      await prisma.config.create({
        data: {
          key: 'suwayomi.enabled',
          value: 'true',
          valueType: 'BOOLEAN',
          scope: 'SYSTEM',
          source: 'DEFAULT'
        }
      });
      console.log('Created suwayomi.enabled config set to true');
    }

    // Also set autoStart to true
    const existingAutoStartConfig = await prisma.config.findFirst({
      where: { key: 'suwayomi.autoStart' }
    });

    if (existingAutoStartConfig) {
      await prisma.config.update({
        where: { id: existingAutoStartConfig.id },
        data: { value: 'true' }
      });
      console.log('Updated existing suwayomi.autoStart to true');
    } else {
      await prisma.config.create({
        data: {
          key: 'suwayomi.autoStart',
          value: 'true',
          valueType: 'BOOLEAN',
          scope: 'SYSTEM',
          source: 'DEFAULT'
        }
      });
      console.log('Created suwayomi.autoStart config set to true');
    }

    // Set default paths
    const defaultPaths = {
      'suwayomi.serverPath': path.join(process.cwd(), 'data', 'suwayomi-server'),
      'suwayomi.configPath': path.join(process.cwd(), 'data', 'suwayomi-config'),
      'suwayomi.downloadDir': path.join(process.cwd(), 'downloads'),
      'suwayomi.port': '4567'
    };

    for (const [key, value] of Object.entries(defaultPaths)) {
      const existing = await prisma.config.findFirst({ where: { key } });
      
      if (!existing) {
        await prisma.config.create({
          data: {
            key,
            value,
            valueType: key.includes('port') ? 'NUMBER' : 'STRING',
            scope: 'SYSTEM',
            source: 'DEFAULT'
          }
        });
        console.log(`Created ${key} config: ${value}`);
      }
    }

    console.log('\n✅ Suwayomi integration has been enabled!');
    console.log('Restart the application for changes to take effect.');
  } catch (error) {
    console.error('Error enabling Suwayomi:', error);
  } finally {
    await prisma.$disconnect();
  }
}

enableSuwayomi();
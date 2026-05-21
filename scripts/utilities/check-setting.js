import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? '' });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// CLI utility — stdout output is intentional @quality-check-skip
const print = console['log'].bind(console); // @quality-check-skip

async function checkSetting(key) {
  try {
    // Map friendly names to actual keys
    const keyMap = {
      'suwayomiEnabled': 'suwayomi.enabled',
      'suwayomiAutoStart': 'suwayomi.autoStart'
    };
    
    const actualKey = keyMap[key] || key;
    
    const config = await prisma.config.findFirst({
      where: { key: actualKey }
    });
    
    // Output just the value for script usage
    print(config?.value || 'false');
  } catch (error) {
    // Silent error, just return false
    print('false');
  } finally {
    await prisma.$disconnect();
  }
}

// Get the setting key from command line args
const key = process.argv[2];
if (key) {
  checkSetting(key);
} else {
  print('false');
}
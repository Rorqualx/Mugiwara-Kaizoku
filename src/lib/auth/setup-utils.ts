import { prisma } from '@/server/db';

/**
 * Checks if the initial setup has been completed (i.e., if any users exist in the database)
 * @returns Promise<boolean> - True if setup is complete, false otherwise
 */
export async function isSetupComplete(): Promise<boolean> {
  const userCount = await prisma.user.count();
  return userCount > 0;
}

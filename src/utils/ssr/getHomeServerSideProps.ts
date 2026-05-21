/**
 * Home Page Server-Side Props Handler
 *
 * Redirects to /setup if no users exist, otherwise renders the home page.
 * Auth is handled client-side via NextAuth useSession.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const SETUP_REDIRECT = {
  redirect: { destination: '/setup', permanent: false },
} as const;

const RENDER_PAGE = { props: {} } as const;

type ServerSidePropsResult =
  | { props: Record<string, never> }
  | { redirect: { destination: string; permanent: boolean } };

export async function getHomeServerSideProps(): Promise<ServerSidePropsResult> {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) return SETUP_REDIRECT;
    return RENDER_PAGE;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error in getServerSideProps for home page:', errorMessage);
    return RENDER_PAGE;
  }
}

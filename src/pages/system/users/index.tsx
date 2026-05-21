/**
 * System Users Management Page
 *
 * Admin-only page for managing system users. Server-side gated:
 * setup must be complete, the visitor must have a session, and the
 * session role must be ADMIN. Otherwise we redirect (to /setup,
 * /login, or /).
 */
import React from "react";
import type { ReactElement } from 'react';

import { Paper, Box } from '@mantine/core';
import { UserRole } from '@prisma/client';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SystemLayout from '@/components/layouts/SystemLayout';
import { withSetupGuard } from '@/components/system/withSetupGuard';
import { ResponsiveUserList } from '@/components/systems/ResponsiveUserList';
import { auth } from '@/lib/auth/config';

import type { GetServerSidePropsContext } from 'next';

export default function SystemUsersPage(): React.ReactElement {
  return <SystemLayout title="User Management">
      <Paper shadow="xs" p="md" withBorder>
        <Box py="md">
          <ResponsiveUserList />
        </Box>
      </Paper>
    </SystemLayout>;
}
SystemUsersPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};

type GuardedProps = { props: Record<string, never> } | { redirect: { destination: string; permanent: boolean } };

const checkAdminAccess = async (context: GetServerSidePropsContext): Promise<GuardedProps> => {
  const session = await auth(context.req, context.res);

  if (!session?.user) {
    const callbackUrl = encodeURIComponent('/system/users');
    return {
      redirect: {
        destination: `/login?callbackUrl=${callbackUrl}`,
        permanent: false,
      },
    };
  }

  // Case-insensitive check — other layers (validate-request.ts /
  // actions.ts) normalize via .toUpperCase() and the value is not
  // consistently cased across the codebase. A strict `!==` against the
  // 'ADMIN' enum can bounce legitimate admins to '/'.
  const role = typeof session.user.role === 'string' ? session.user.role.toUpperCase() : '';
  if (role !== UserRole.ADMIN) {
    return {
      redirect: { destination: '/', permanent: false },
    };
  }

  return { props: {} };
};

export const getServerSideProps = withSetupGuard(checkAdminAccess);

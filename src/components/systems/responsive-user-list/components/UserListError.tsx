/**
 * Error state component for user list
 */
import React from 'react';

import { Paper, Center, Stack, Alert, Button } from '@mantine/core';
import { IconAlertCircle, IconLogin } from '@tabler/icons-react';

interface UserListErrorProps {
  error: Error;
  onRetry: () => void;
}

/**
 * Checks if an error is an authentication/authorization error
 *
 * @param errorMessage - The error message to check
 * @returns True if the error is auth-related
 */
function isAuthError(errorMessage: string): boolean {
  return (
    errorMessage.includes('logged in') ||
    errorMessage.includes('UNAUTHORIZED') ||
    errorMessage.includes('admin') ||
    errorMessage.includes('FORBIDDEN')
  );
}

/**
 * UserListError component
 *
 * @param props - Component props
 * @returns React element
 */
export function UserListError({
  error,
  onRetry,
}: UserListErrorProps): React.ReactElement {
  const errorMessage = error.message;
  const isAuth = isAuthError(errorMessage);

  return (
    <Paper p="xl" withBorder>
      <Center>
        <Stack align="center" gap="md">
          {isAuth ? (
            <>
              <IconLogin size={48} color="var(--mantine-color-yellow-6)" />
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Authentication Required"
                color="yellow"
              >
                You must be logged in as an administrator to view and manage
                users.
              </Alert>
              <Button
                component="a"
                href="/auth/signin"
                leftSection={<IconLogin size={16} />}
              >
                Sign In
              </Button>
            </>
          ) : (
            <>
              <IconAlertCircle size={48} color="var(--mantine-color-red-6)" />
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Error Loading Users"
                color="red"
              >
                {errorMessage}
              </Alert>
              <Button
                variant="light"
                onClick={() => {
                  void onRetry();
                }}
              >
                Try Again
              </Button>
            </>
          )}
        </Stack>
      </Center>
    </Paper>
  );
}

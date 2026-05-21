/**
 * Login Page
 *
 * Handles user authentication with secure login form using Auth.js.
 * Features:
 * - Form validation
 * - Error handling
 * - Loading states
 * - Secure password handling
 * - Admin-only access
 * - Redirect logic
 *
 * Security Features:
 * - Server-side authentication
 * - Credential validation
 * - Session management
 * - CSRF protection
 *
 * @module pages/login
 * @requires @mantine/core - UI components
 * @requires @mantine/form - Form handling
 * @requires next/router - Navigation
 * @requires @auth/react - Authentication
 * @requires @/lib/prisma - Database access
 */
"use client";
import type { ReactElement } from 'react';
import { createElement, useState, useEffect } from 'react';

import { TextInput, PasswordInput, Paper, Title, Container, Button, Text, Divider, Alert, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { useSession } from 'next-auth/react';

import { AuthLayout } from '../components/layouts/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import { authOptions } from '../lib/auth/config';
import { logger } from '../utils/logger';

import type { PrismaClient } from '@prisma/client';
import type { GetServerSidePropsContext } from 'next';

/**
 * Login Form Component
 *
 * Provides a secure authentication interface for admin users.
 * Handles form submission, validation, and error display.
 *
 * Features:
 * - Input validation
 * - Error messaging
 * - Loading states
 * - Secure submission
 * - Responsive design
 * - Callback URL handling
 *
 * @component
 * @example
 * ```tsx
 * // In router/navigation
 * <Route path="/login" component={LoginPage} />
 * ```
 */
function LoginPage(): React.ReactElement {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { status } = useSession();
  const { login } = useAuth();
  // Get the callback URL from the query parameters
  const callbackUrl = (Array.isArray(router.query["callbackUrl"]) ?
  router.query?.["callbackUrl"]?.[0] :
  router.query["callbackUrl"]) ?? '/';
  // Redirect to callback URL if already authenticated (but not if just signed out)
  useEffect(() => {
    if (status === 'authenticated' && !router.query['callbackUrl']?.toString().includes('signout')) {
      void router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);
  /**
   * Form Configuration
   *
   * Sets up form validation and initial values.
   * Validates:
   * - Identifier (username/email) length
   * - Password minimum length
   */
  const form = useForm({
    initialValues: {
      identifier: '',
      password: ''
    },
    validate: {
      identifier: (value: string) => value.length < 3 ? 'Please enter a valid username or email' : null,
      password: (value: string) => value.length < 6 ? 'Password should be at least 6 characters' : null
    }
  });
  /**
   * Form Submission Handler
   *
   * Processes login attempts with error handling and loading states.
   * Uses the useAuth hook for standardized authentication.
   *
   * @param {Object} values - Form values containing identifier and password
   */
  const handleSubmit = async (values: typeof form.values): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      // No need to log user credentials, even with masked password
      // Use standardized auth hook with the new signature
      const result = await login({
        identifier: values.identifier,
        password: values.password,
        callbackUrl: callbackUrl as string
      });
      if (!result.success) {
        // result.error is already a string from useAuth
        const errorMessage = result.error ?? 'Invalid credentials';
        logger.error('Login failed', { error: errorMessage });
        setError(errorMessage);
      } else
      {
        logger.info('Login successful, redirecting');
        void router.push(callbackUrl);
      }
    }
    catch (err: unknown) {
      logger.error('Login process error');
      // Only log detailed errors in non-production
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Login error details:', err instanceof Error ? err.message : String(err));
      }
      setError('An error occurred during login. Please try again.');
    } finally
    {
      setIsLoading(false);
    }
  };
  // Don't render the form if already authenticated
  if (status === 'authenticated') {
    return <Container size="xs" py="xl">
        <Paper withBorder shadow="md" p={30} radius="md" mt="xl">
          <Text ta="center">You are already logged in.</Text>
          <Text ta="center" c="dimmed" size="sm">Redirecting...</Text>
        </Paper>
      </Container>;
  }
  return <Container size="xs" py="xl">
      <Title order={2} ta="center" mb="lg">
        Login to Kaizoku
      </Title>
      
      <Paper withBorder shadow="md" p={30} radius="md" mt="xl">
        {error &&
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">

            {error}
          </Alert>}
        
        <Box component="form" onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput label="Username or Email" placeholder="Enter your username or email" required {...form.getInputProps('identifier')} />

          
          <PasswordInput label="Password" placeholder="Your password" required mt="md" {...form.getInputProps('password')} />

          
          <Button fullWidth mt="xl" type="submit" loading={isLoading}>

            Sign in
          </Button>
        </Box>
        
        <Divider my="md" label="Admin access only" labelPosition="center" />
        
        <Text c="dimmed" size="sm" ta="center">
          This area is restricted to administrators only.
        </Text>
      </Paper>
    </Container>;
}
/**
 * Layout Configuration
 *
 * Applies the authentication layout wrapper to the login page.
 * Provides consistent styling and structure for auth pages.
 *
 * @param {ReactElement} page - Page component to wrap
 * @returns {ReactElement} Wrapped page with auth layout
 */
LoginPage.getLayout = function getLayout(page: ReactElement): ReactElement {
  return createElement(AuthLayout, null, page);
};
export default LoginPage;
/**
 * Server-side Props Handler
 *
 * Performs pre-render authentication checks:
 * 1. Verifies if any users exist in the system
 * 2. Checks current authentication status using Auth.js
 *
 * Redirects:
 * - To home if no users exist (first-time setup)
 * - To home if already authenticated
 *
 * @function
 * @async
 * @param {Object} context - Next.js page context
 * @returns {Promise<Object>} Page props or redirect configuration
 */
export const getServerSideProps = async (context: GetServerSidePropsContext): Promise<{
  props: Record<string, never>;
} | {
  redirect: {
    destination: string;
    permanent: boolean;
  };
}> => {
  try {
    // Check if any users exist in the database
    const { prisma } = await import('../server/db') as { prisma: PrismaClient };
    const userCount = await prisma.user.count();
    // If no users exist, redirect to create admin page
    if (userCount === 0) {
      logger.info('No users found, redirecting to setup page');
      return {
        redirect: {
          destination: '/setup',
          permanent: false
        }
      };
    }
    // Check if user is already authenticated using NextAuth
    // @ts-expect-error NextAuth v4/v5 type compatibility issue
    const session = await getServerSession(context.req, context.res, authOptions);
    // If user is already logged in, redirect to home page
    if (session?.user) {
      logger.info('User already authenticated, redirecting to home');
      return {
        redirect: {
          destination: '/',
          permanent: false
        }
      };
    }
    // Otherwise, show the login page
    return {
      props: {}
    };
  }
  catch (error: unknown) {
    logger.error('Error in login page server-side props');
    // Only log detailed errors in non-production
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('Login page error details:', error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error));
    }
    // Show login page on error (don't redirect to avoid loops)
    return {
      props: {}
    };
  }
};
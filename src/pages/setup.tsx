/**
 * Setup Page
 * 
 * Handles first-time system setup and initial admin user creation.
 * This page is only accessible when no users exist in the system.
 * 
 * Features:
 * - First-time setup flow
 * - Admin user creation
 * - Access control
 * - Automatic redirects
 * 
 * Security Features:
 * - User existence verification
 * - Authentication checks
 * - Single admin enforcement
 * - Secure routing
 * 
 * @module pages/setup
 * @requires next - Next.js utilities
 * @requires @mantine/core - UI components
 * @requires @/components/auth - Authentication components
 * @requires @/lib/prisma - Database access
 * @requires @/lib/auth - Authentication utilities
 */

import { createElement } from "react";
import type { ReactElement } from 'react';

import { Box } from '@mantine/core';


import { FirstTimeSetup } from '../components/auth/FirstTimeSetup';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { auth } from '../lib/auth/config';
import { prisma } from "../server/db";

import type { GetServerSidePropsContext } from 'next';

/**
 * Setup Page Component
 * 
 * Renders the first-time setup interface within a constrained width container.
 * Uses the FirstTimeSetup component to handle admin user creation and
 * initial system configuration.
 * 
 * @component
 * @example
 * ```tsx
 * // Automatically rendered for first-time setup
 * <SetupPage />
 * ```
 */
function SetupPage(): React.ReactElement {
  return (
    <Box maw={1000} mx="auto">
      <FirstTimeSetup />
    </Box>);

}

/**
 * Layout Configuration
 * 
 * Applies the authentication layout wrapper to the setup page.
 * Provides consistent styling and structure for auth-related pages.
 * 
 * @param {ReactElement} page - Page component to wrap
 * @returns {ReactElement} Wrapped page with auth layout
 */
SetupPage.getLayout = function getLayout(page: ReactElement): ReactElement {
  return createElement(AuthLayout, null, page);
};

export default SetupPage;

/**
 * Server-side Props Handler
 * 
 * Performs pre-render setup checks:
 * 1. Verifies if any users exist
 * 2. Checks current authentication status
 * 
 * Redirects:
 * - To login if users already exist
 * - To home if already authenticated
 * 
 * This ensures the setup page is only accessible during
 * first-time system configuration.
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
  // Check if any users exist in the database
  const userCount = await prisma.user.count();

  // If users already exist, redirect to login page
  if (userCount > 0) {
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }

  // Check if user is already authenticated using Auth.js
  const session = await auth(context.req, context.res);

  // If user is already logged in, redirect to home page
  if (session) {
    return {
      redirect: {
        destination: '/',
        permanent: false
      }
    };
  }

  // Otherwise, show the setup page
  return {
    props: {}
  };
};
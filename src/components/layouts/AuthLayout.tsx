"use client";

/**
 * AuthLayout component for authentication-related pages
 * 
 * This component provides a consistent layout for authentication pages,
 * including login, registration, and setup screens. Features include:
 * - Centered content layout
 * - Full viewport height
 * - Consistent background styling
 * - Page title management
 * 
 * @remarks
 * Layout Structure:
 * - Full viewport height container
 * - Centered content vertically and horizontally
 * - Fixed width container for content
 * - Light background color
 * 
 * Styling:
 * - Flexbox-based layout
 * - Column direction for content flow
 * - Neutral background color (#f8f9fa)
 * - Responsive container width
 * 
 * @example
 * ```jsx
 * // Basic usage with login form
 * <AuthLayout>
 *   <LoginForm />
 * </AuthLayout>
 * ```
 */

import React from "react";

// Import Box and Container directly from Mantine
import { Box, Container } from '@mantine/core';
import Head from 'next/head';

/**
 * Props for the AuthLayout component
 */
interface AuthLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps): React.ReactElement {
  return (
    <>
      <Head>
        <title>Kaizoku - Authentication</title>
      </Head>
      <Box
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#f8f9fa',
        }}
      >
        <Container size="md">
          {children}
        </Container>
      </Box>
    </>
  );
}

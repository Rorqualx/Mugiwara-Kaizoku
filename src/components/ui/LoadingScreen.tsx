/**
 * Loading Screen Component
 * 
 * Displays a loading indicator with optional message.
 * Used throughout the application for async operations.
 * 
 * Features:
 * - Customizable loading message
 * - Spinner animation
 * - Full-screen or inline display options
 * - Themable appearance
 * 
 * @module components/ui/LoadingScreen
 */

import React from 'react';

import { Center, Loader, Stack, Text, Paper } from '@mantine/core';

/**
 * Props for the LoadingScreen component
 */
interface LoadingScreenProps {
  /** Message to display while loading */
  message?: string;
  /** Secondary message or description */
  description?: string;
  /** Whether to display in fullscreen mode */
  fullscreen?: boolean;
  /** Size of the loading spinner */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional className for styling */
  className?: string;
}

/**
 * Loading screen component
 * 
 * @param {LoadingScreenProps} props - Component props
 * @returns {JSX.Element} Rendered component
 */
export default function LoadingScreen({
  message = 'Loading...',
  description,
  fullscreen = true,
  size = 'md',
  className = ''
}: LoadingScreenProps): React.ReactElement {
  // Content to display
  const content =
  <Stack align="center" gap="xs">
      <Loader size={size} />
      <Text fw={500}>{message}</Text>
      {description && <Text size="sm" c="dimmed">{description}</Text>}
    </Stack>;


  // For fullscreen mode
  if (fullscreen) {
    return (
      <Center
        style={{
          height: '100vh',
          width: '100%',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.8)'
        }}
        className={className}>

        <Paper shadow="md" p="xl" radius="md">
          {content}
        </Paper>
      </Center>);

  }

  // For inline mode
  return (
    <Center py="xl" className={className}>
      {content}
    </Center>);

}
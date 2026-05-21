"use client";

/**
 * Client-side modal and notification provider wrapper
 * 
 * This component provides a unified configuration for modals and notifications
 * across the application. Features include:
 * - Centralized modal management
 * - Global notification system
 * - SSR compatibility
 * - Consistent styling
 * 
 * @remarks
 * Modal Configuration:
 * - Centered positioning
 * - Scroll locking
 * - Blur overlay
 * - Consistent styling
 * 
 * Notification Features:
 * - Top-center positioning
 * - Limited queue (5 items)
 * - Auto-close behavior
 * - Custom styling
 * 
 * SSR Handling:
 * - Dynamic import for proper server-side rendering
 * - Maintains hydration consistency
 * 
 * @example
 * ```tsx
 * // Wrap your app with modal and notification support
 * <ClientModalWrapper>
 *   <YourApp />
 * </ClientModalWrapper>
 * ```
 */

import React from "react";

import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import dynamic from "next/dynamic";

/**
 * Props for the ClientModalWrapper component
 */
interface ClientModalWrapperProps {
  /** Child components to render within the modal and notification context */
  children: React.ReactNode;
}

export function ClientModalWrapper({ children }: ClientModalWrapperProps): React.ReactElement {
  return (
    <ModalsProvider
      modalProps={{
        centered: true,
        lockScroll: true,
        padding: "md",
        radius: "md",
        withCloseButton: true,
        overlayProps: {
          blur: 3,
          opacity: 0.55,
        },
        styles: {
          header: {
            marginBottom: 'var(--mantine-spacing-xs)',
          },
          close: {
            width: 34,
            height: 34,
            color: 'var(--mantine-color-gray-5)',
            
            '&:hover': {
              backgroundColor: 'var(--mantine-color-gray-0)',
            },
          },
          content: {
            padding: 'var(--mantine-spacing-md)',
          },
        },
      }}
    >
      <Notifications
        position="top-center"
        limit={5}
        containerWidth={400}
        autoClose={4000}
        styles={{
          root: {
            marginTop: 'var(--mantine-spacing-xl)',
            boxShadow: 'var(--mantine-shadow-md)',
            border: '1px solid var(--mantine-color-gray-2)',
          },
        }}
      />
      {children}
    </ModalsProvider>
  );
}

// Export with dynamic import for proper SSR handling
export default dynamic(() => Promise.resolve(ClientModalWrapper), {
  ssr: true,
});

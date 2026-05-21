/**
 * Empty state prompt component for library creation
 * 
 * This component displays a centered prompt when no manga libraries
 * are found, encouraging users to create their first library.
 * Features include:
 * - Visual empty state
 * - Library creation button
 * - Centered layout
 * - Descriptive text
 * 
 * @remarks
 * Visual Elements:
 * - Book icon
 * - Title text
 * - Helper text
 * - Create library button
 * 
 * Layout Structure:
 * - Centered content
 * - Stacked elements
 * - Consistent spacing
 * - Responsive design
 * 
 * @example
 * ```tsx
 * <EmptyPrompt
 *   onCreate={() => {
 *     // Handle library creation
 *     refetchLibraries();
 *   }}
 * />
 * ```
 */

import React from "react";

import { Center, Stack, Text, Title } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconBooks } from '@tabler/icons-react';

import { AddLibrary } from "./addLibrary";

/**
 * Props for the EmptyPrompt component
 */
interface EmptyPromptProps {
  /** Callback function called after library creation */
  onCreate: () => void;
}

/**
 * Empty state component for prompting library creation
 * 
 * @param props - Component properties
 */
export function EmptyPrompt({ onCreate }: EmptyPromptProps): React.JSX.Element {
  const handleCreate = (): void => {
    onCreate();
  };

  return (
    <Stack gap="md">
      <Center h="100%" display="flex" style={{ justifyContent: 'center', alignItems: 'center', paddingTop: 56 }}>
        <Stack 
          justify="center" 
          align="center" 
          gap="md"
        >
          <IconBooks size={48} strokeWidth={1.5} />
          <Title>No Manga Found</Title>
          <Text 
            size="sm" 
            c="gray.6"
          >
            Create a library to start adding manga to your collection
          </Text>
          <AddLibrary onCreate={handleCreate} size="xl" />
        </Stack>
      </Center>
    </Stack>
  );
}

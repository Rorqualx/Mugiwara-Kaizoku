/**
 * Generic empty state component for content-less views
 * 
 * This component provides a consistent empty state display across
 * the application. Features include:
 * - Customizable icon
 * - Title and description text
 * - Centered layout
 * - Consistent styling
 * 
 * @remarks
 * Visual Elements:
 * - Default warning icon (customizable)
 * - Title text
 * - Description text
 * - Vertical stacking
 * 
 * Layout Structure:
 * - Centered content
 * - Consistent spacing
 * - Responsive design
 * - Fixed top padding
 * 
 * @example
 * ```tsx
 * // Basic usage with default warning icon
 * <EmptyState
 *   title="No Results Found"
 *   description="Try adjusting your search criteria"
 * />
 * 
 * // Custom icon usage
 * <EmptyState
 *   title="No Data"
 *   description="Start by adding some items"
 *   icon={<IconDatabase size={48} />}
 * />
 * ```
 */

import React from "react";

import { Center, Stack, Text, Title } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconAlertTriangle } from '@tabler/icons-react';

/**
 * Props for the EmptyState component
 */
interface EmptyStateProps {
  /** Main title text displayed */
  title: string;
  /** Descriptive text explaining the empty state */
  description: string;
  /** Optional custom icon element (defaults to warning icon) */
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon = <IconAlertTriangle size={48} strokeWidth={1.5} /> }: EmptyStateProps): React.JSX.Element {
  return (
    <Center h="100%" display="flex" style={{ justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
      <Stack 
        justify="center" 
        align="center" 
        gap="md"
      >
        {icon}
        <Title>{title}</Title>
        <Text 
          size="sm" 
          c="gray.6"
        >
          {description}
        </Text>
      </Stack>
    </Center>
  );
}

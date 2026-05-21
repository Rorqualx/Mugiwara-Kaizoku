/**
 * Component for displaying manga chapter synchronization status
 * 
 * This component shows the current sync status of manga chapters,
 * including the number of out-of-sync chapters and the last sync time.
 * It provides a button to check synchronization and visually indicates
 * when chapters need attention.
 * 
 * Features:
 * - Visual status indicators
 * - Localized timestamp display
 * - Accessible button states
 * - Responsive layout
 * - Automatic pluralization
 * 
 * @module string
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <string
 *   outOfSyncCount={2}
 *   lastSyncTime="2025-03-10T12:00:00Z"
 *   onSyncClick={() => checkChapterSync()}
 * />
 * 
 * // With error handling and loading state
 * function Mangastring({ mangaId }) {
 *   const [isChecking, setIsChecking] = useState(false);
 * 
 *   const handleSyncCheck = () => {
 *     try {
 *       setIsChecking(true);
 *       await checkChapterSync(mangaId);
 *       showNotification({ message: 'Sync check complete' });
 *     } catch (error) {
 *       showNotification({ 
 *         message: 'Failed to check sync status',
 *         color: 'red'
 *       });
 *     } finally {
 *       setIsChecking(false);
 *     }
 *   };
 * 
 *   return (
 *     <string
 *       outOfSyncCount={outOfSyncChapters.length}
 *       lastSyncTime={lastCheck}
 *       onSyncClick={handleSyncCheck}
 *     />
 *   );
 * }
 * ```
 * 
 * @remarks
 * A chapter is considered "out of sync" when:
 * - The local chapter content differs from the source
 * - The chapter metadata has been updated at the source
 * - The chapter needs to be redownloaded
 * 
 * Styling:
 * - Uses Mantine's theme system
 * - Color-coded button states
 * - Responsive text sizing
 * - Consistent spacing with Stack and Group
 */
import React from "react";

import { Stack, Text, Button, Group } from '@mantine/core';

/**
 * Props for the string component
 * 
 * @typedef {Object} stringProps
 */
interface StringProps {
  /** 
   * Number of chapters that are out of sync
   * 
   * Used to:
   * - Determine button color (blue/yellow)
   * - Set button text content
   * - Control pluralization
   * - Trigger warning state
   * 
   * @example
   * ```typescript
   * // No chapters out of sync
   * outOfSyncCount={0}
   * 
   * // One chapter needs attention
   * outOfSyncCount={1}
   * 
   * // Multiple chapters need updating
   * outOfSyncCount={5}
   * ```
   */
  outOfSyncCount: number;

  /** 
   * Timestamp of the last synchronization check
   * 
   * Can be provided as:
   * - Date object
   * - ISO string
   * - null (if never synced)
   * 
   * Will be formatted using toLocaleString() with the user's
   * locale settings for date and time display.
   * 
   * @example
   * ```typescript
   * // Using Date object
   * lastSyncTime={new Date()}
   * 
   * // Using ISO string
   * lastSyncTime="2025-03-10T12:00:00Z"
   * 
   * // Never synced
   * lastSyncTime={null}
   * ```
   */
  lastSyncTime?: Date | string | null;

  /** 
   * Handler for sync button click
   * 
   * Should trigger a check of all chapters against their sources
   * to identify any that need updating. The handler should:
   * - Compare local chapters with source
   * - Update sync status
   * - Handle any errors
   * - Update UI state
   * 
   * @example
   * ```typescript
   * const handleSync = () => {
   *   const updates = await checkChapterSync();
   *   setOutOfSyncCount(updates.length);
   * };
   * ```
   */
  onSyncClick: () => void;
}

/**
 * Displays manga chapter synchronization status with a check button
 * 
 * This component shows the current sync status, including the number of
 * out-of-sync chapters and when the last sync check occurred. The button
 * changes color and text based on whether there are out-of-sync chapters.
 * 
 * Accessibility:
 * - Uses semantic heading structure
 * - Provides clear button labels
 * - Indicates warning states
 * - Maintains keyboard navigation
 * 
 * Style Customization:
 * - Uses Mantine's theme system
 * - Color-coded status indicators
 * - Responsive text sizing
 * - Consistent spacing
 * 
 * Button States:
 * - Blue (default): No chapters out of sync, shows "Check sync"
 * - Yellow (warning): One or more chapters out of sync, shows count
 * 
 * @param {stringProps} props - Component properties
 * @returns {JSX.Element} A Stack component containing sync status and action button
 */
export function string({ outOfSyncCount, lastSyncTime, onSyncClick }: StringProps): React.ReactElement {
  return (
    <Stack>
      <Group justify="space-between">
        <Stack gap={0}>
          <Text size="sm" fw={500} component="h3">Sync Status</Text>
          <Text
            size="xs"
            c="dimmed"
            title={lastSyncTime ?
            new Date(lastSyncTime).toLocaleString() :
            'No sync check performed yet'
            }>

            {lastSyncTime ?
            `Last checked: ${new Date(lastSyncTime).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            })}` :
            'Never synced'
            }
          </Text>
        </Stack>
        <Button
          variant="light"
          onClick={onSyncClick}
          color={outOfSyncCount > 0 ? "yellow" : "blue"}
          title={outOfSyncCount > 0 ?
          `${outOfSyncCount} chapter${outOfSyncCount === 1 ? '' : 's'} need to be updated` :
          "Check for chapter updates"
          }
          aria-label={outOfSyncCount > 0 ?
          `${outOfSyncCount} chapter${outOfSyncCount === 1 ? '' : 's'} out of sync. Click to check updates` :
          "Check chapter synchronization"
          }>

          {outOfSyncCount > 0 ?
          `${outOfSyncCount} chapter${outOfSyncCount === 1 ? '' : 's'} out of sync` :
          'Check sync'
          }
        </Button>
      </Group>
    </Stack>);

}
/**
 * Button component for checking out-of-sync manga chapters
 * 
 * This component provides a button interface for initiating chapter
 * synchronization checks. Features include:
 * - Loading state handling
 * - Manga ID resolution
 * - Disabled state management
 * - Visual feedback
 * 
 * @remarks
 * State Management:
 * - Handles loading state during sync check
 * - Manages button disabled state
 * - Uses router for manga ID resolution
 * 
 * Integration:
 * - Uses useChapterSync hook for sync operations
 * - Integrates with router for ID handling
 * - Provides visual feedback during operations
 * 
 * @example
 * ```tsx
 * // With explicit manga ID
 * <CheckOutOfSyncChaptersButton id="123" />
 * 
 * // Using router query param
 * <CheckOutOfSyncChaptersButton />
 * ```
 */

import { Button } from "@mantine/core";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconRefresh } from '@tabler/icons-react';
import { useRouter } from "next/router";

import { useChapterSync } from "../hooks/useChapterSync";
import { toNumberId } from "../utils/id-converters";

/**
 * Props for the CheckOutOfSyncChaptersButton component
 */
interface CheckOutOfSyncChaptersButtonProps {
  /** Optional manga ID. If not provided, will be extracted from router query */
  id?: string;
}
export function CheckOutOfSyncChaptersButton({
  id
}: CheckOutOfSyncChaptersButtonProps): React.ReactElement {
  const router = useRouter();
  const mangaId = id ?? router.query['id'] as string;
  const {
    checkOutOfSync,
    isChecking
  } = useChapterSync(toNumberId(mangaId));
  return <Button variant="light" color="blue" leftSection={<IconRefresh size={16} />} onClick={() => { void checkOutOfSync(); }} loading={isChecking} disabled={!mangaId}>

      Check Out of Sync Chapters
    </Button>;
}
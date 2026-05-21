/**
 * BookmarkList Component
 *
 * Modal for viewing and managing audio bookmarks.
 * Allows jumping to bookmarked positions and adding notes.
 *
 * @module components/audioPlayer/features/BookmarkList
 */

import { memo, useCallback, useState } from 'react';

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBookmark,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';

import type { AudioBookmarkData, BookmarkColor } from '@/types/audioPlayer';

import { useAudioPlayerContext } from '../AudioPlayerProvider';


// ============================================================================
// Types
// ============================================================================

export interface BookmarkListProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Existing bookmarks */
  bookmarks?: AudioBookmarkData[];
  /** Callback when bookmark is added */
  onAddBookmark?: (bookmark: Omit<AudioBookmarkData, 'id' | 'createdAt' | 'userId'>) => void;
  /** Callback when bookmark is deleted */
  onDeleteBookmark?: (id: number) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time in seconds to MM:SS or HH:MM:SS format
 */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// Bookmark Color Options
// ============================================================================

const BOOKMARK_COLORS: { name: string; value: BookmarkColor; mantineColor: string }[] = [
  { name: 'Red', value: '#FF6B6B', mantineColor: 'red' },
  { name: 'Teal', value: '#4ECDC4', mantineColor: 'teal' },
  { name: 'Blue', value: '#45B7D1', mantineColor: 'blue' },
  { name: 'Green', value: '#96CEB4', mantineColor: 'green' },
  { name: 'Yellow', value: '#FFEAA7', mantineColor: 'yellow' },
  { name: 'Purple', value: '#DDA0DD', mantineColor: 'grape' },
  { name: 'Orange', value: '#FFB347', mantineColor: 'orange' },
];

// ============================================================================
// Add Bookmark Form Component
// ============================================================================

interface AddBookmarkFormProps {
  currentTime: number;
  onAdd: (note: string, color: BookmarkColor) => void;
  onCancel: () => void;
}

function AddBookmarkForm({
  currentTime,
  onAdd,
  onCancel,
}: AddBookmarkFormProps): JSX.Element {
  const [note, setNote] = useState('');
  const [selectedColor, setSelectedColor] = useState<BookmarkColor>('#45B7D1');

  const handleSubmit = useCallback((): void => {
    onAdd(note, selectedColor);
    setNote('');
    setSelectedColor('#45B7D1');
  }, [note, selectedColor, onAdd]);

  const selectedMantineColor = BOOKMARK_COLORS.find(c => c.value === selectedColor)?.mantineColor ?? 'blue';

  return (
    <Stack gap="sm" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-light)', borderRadius: 'var(--mantine-radius-md)' }}>
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          Add bookmark at {formatTime(currentTime)}
        </Text>
        <ActionIcon variant="subtle" size="sm" onClick={onCancel}>
          <IconTrash size={14} />
        </ActionIcon>
      </Group>

      <TextInput
        placeholder="Add a note (optional)"
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        size="sm"
      />

      <Group gap="xs">
        {BOOKMARK_COLORS.map((color) => (
          <ActionIcon
            key={color.value}
            variant={selectedColor === color.value ? 'filled' : 'light'}
            color={color.mantineColor}
            size="sm"
            radius="xl"
            onClick={() => setSelectedColor(color.value)}
            aria-label={color.name}
            style={selectedColor === color.value ? undefined : { backgroundColor: color.value }}
          />
        ))}
      </Group>

      <Group justify="flex-end" gap="xs">
        <Button variant="subtle" size="xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="xs" color={selectedMantineColor} onClick={handleSubmit}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}

// ============================================================================
// Bookmark Item Component
// ============================================================================

interface BookmarkItemProps {
  bookmark: AudioBookmarkData;
  onSelect: (timestamp: number) => void;
  onDelete: (id: number) => void;
}

function BookmarkItem({
  bookmark,
  onSelect,
  onDelete,
}: BookmarkItemProps): JSX.Element {
  // Map hex color to mantine color for display
  const mantineColor = BOOKMARK_COLORS.find(c => c.value === bookmark.color)?.mantineColor ?? 'blue';

  return (
    <UnstyledButton
      onClick={() => onSelect(bookmark.timestamp)}
      p="sm"
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        backgroundColor: 'var(--mantine-color-gray-light)',
        transition: 'background-color 0.2s ease',
      }}
      w="100%"
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
          <IconBookmark
            size={20}
            color={bookmark.color ?? '#45B7D1'}
            fill={bookmark.color ?? '#45B7D1'}
          />
          <Stack gap={2} style={{ flex: 1, overflow: 'hidden' }}>
            <Group gap="xs">
              <Badge size="xs" variant="light" color={mantineColor}>
                {formatTime(bookmark.timestamp)}
              </Badge>
              {bookmark.label && (
                <Text size="xs" fw={500}>
                  {bookmark.label}
                </Text>
              )}
            </Group>
            {bookmark.note && (
              <Text size="xs" c="dimmed" truncate>
                {bookmark.note}
              </Text>
            )}
          </Stack>
        </Group>

        <ActionIcon
          variant="subtle"
          color="red"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(bookmark.id);
          }}
          aria-label="Delete bookmark"
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Group>
    </UnstyledButton>
  );
}

// ============================================================================
// Component
// ============================================================================

function BookmarkListComponent({
  opened,
  onClose,
  bookmarks = [],
  onAddBookmark,
  onDeleteBookmark,
}: BookmarkListProps): JSX.Element {
  const { player } = useAudioPlayerContext();
  const { currentTime, seek, currentTrack } = player;

  const [isAdding, setIsAdding] = useState(false);

  // Handle jumping to bookmark
  const handleSelectBookmark = useCallback(
    (timestamp: number): void => {
      seek(timestamp);
      onClose();
    },
    [seek, onClose]
  );

  // Handle adding bookmark
  const handleAddBookmark = useCallback(
    (note: string, color: BookmarkColor): void => {
      if (onAddBookmark && currentTrack) {
        onAddBookmark({
          timestamp: currentTime,
          note: note || undefined,
          color,
          mangaId: currentTrack.mangaId,
          chapterId: currentTrack.chapterId,
          label: undefined,
        });
      }
      setIsAdding(false);
    },
    [onAddBookmark, currentTime, currentTrack]
  );

  // Handle deleting bookmark
  const handleDeleteBookmark = useCallback(
    (id: number): void => {
      if (onDeleteBookmark) {
        onDeleteBookmark(id);
      }
    },
    [onDeleteBookmark]
  );

  // Sort bookmarks by timestamp
  const sortedBookmarks = [...bookmarks].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconBookmark size={20} />
          <Title order={4}>Bookmarks</Title>
        </Group>
      }
      centered
      size="md"
    >
      <Stack gap="md">
        {/* Add bookmark button */}
        {!isAdding ? (
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setIsAdding(true)}
            disabled={!currentTrack}
          >
            Add bookmark at current position
          </Button>
        ) : (
          <AddBookmarkForm
            currentTime={currentTime}
            onAdd={handleAddBookmark}
            onCancel={() => setIsAdding(false)}
          />
        )}

        {/* Bookmark list */}
        {sortedBookmarks.length === 0 ? (
          <Stack align="center" py="xl">
            <IconBookmark size={48} color="var(--mantine-color-dimmed)" />
            <Text c="dimmed">No bookmarks yet</Text>
            <Text size="xs" c="dimmed" ta="center">
              Add bookmarks to quickly return to important moments
            </Text>
          </Stack>
        ) : (
          <ScrollArea.Autosize mah={300} offsetScrollbars>
            <Stack gap="xs">
              {sortedBookmarks.map((bookmark) => (
                <BookmarkItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  onSelect={handleSelectBookmark}
                  onDelete={handleDeleteBookmark}
                />
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}

        {/* Bookmark count footer */}
        {sortedBookmarks.length > 0 && (
          <Text size="xs" c="dimmed" ta="center">
            {sortedBookmarks.length} bookmark{sortedBookmarks.length === 1 ? '' : 's'}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

export const BookmarkList = memo(BookmarkListComponent);
export default BookmarkList;

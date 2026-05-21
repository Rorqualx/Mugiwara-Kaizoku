/**
 * Priority Order Editor Component
 *
 * Compact drag-and-drop interface for reordering metadata provider priorities.
 * Uses @dnd-kit for sortable functionality.
 *
 * @module components/settings/PriorityOrderEditor
 */

import React from 'react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Group, Badge, Box } from '@mantine/core';

/**
 * Fixed width for provider badges - ensures all badges are same width
 * Based on longest name (COMICVINE/WIKIPEDIA) plus number and padding
 */
const BADGE_WIDTH = 120;

/**
 * Gap between provider badges
 */
const BADGE_GAP = 8;

/**
 * Props for PriorityOrderEditor
 */
export interface PriorityOrderEditorProps {
  /** Current priority order (array of provider names) */
  providers: string[];
  /** Callback when order changes */
  onChange: (providers: string[]) => void;
  /** Status of each provider */
  providerStatus?: Record<string, boolean>;
}

/**
 * Props for SortableProviderItem
 */
interface SortableProviderItemProps {
  provider: string;
  index: number;
  isActive: boolean;
}

/**
 * Sortable provider badge item
 */
function SortableProviderItem({ provider, index }: SortableProviderItemProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };

  return (
    <Badge
      ref={setNodeRef}
      size="lg"
      variant={index === 0 ? 'filled' : 'light'}
      color={index === 0 ? 'blue' : 'gray'}
      radius="md"
      style={{
        ...style,
        cursor: isDragging ? 'grabbing' : 'grab',
        paddingLeft: 8,
        paddingRight: 10,
        fontWeight: 500,
        width: BADGE_WIDTH,
        minWidth: BADGE_WIDTH,
        justifyContent: 'flex-start',
      }}
      {...attributes}
      {...listeners}
    >
      <Group gap={6} wrap="nowrap">
        <Box
          component="span"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            fontSize: '11px',
            fontWeight: 700,
            opacity: 0.8,
            borderRadius: '50%',
            backgroundColor: index === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
          }}
        >
          {index + 1}
        </Box>
        <Box component="span" style={{ fontSize: '13px', textTransform: 'uppercase' }}>{provider}</Box>
      </Group>
    </Badge>
  );
}

/**
 * Priority Order Editor Component
 */
export function PriorityOrderEditor({
  providers,
  onChange,
  providerStatus = {},
}: PriorityOrderEditorProps): React.ReactElement {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragEndEvent): void => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = providers.indexOf(active.id as string);
      const newIndex = providers.indexOf(over.id as string);

      onChange(arrayMove(providers, oldIndex, newIndex));
    }

    setActiveId(null);
  };

  const handleDragCancel = (): void => {
    setActiveId(null);
  };

  const activeProvider = activeId ? providers.find(p => p === activeId) : null;
  const activeIndex = activeProvider ? providers.indexOf(activeProvider) : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={providers} strategy={horizontalListSortingStrategy}>
        <Group gap={BADGE_GAP} wrap="nowrap">
          {providers.map((provider, index) => (
            <SortableProviderItem
              key={provider}
              provider={provider}
              index={index}
              isActive={providerStatus[provider] !== false}
            />
          ))}
        </Group>
      </SortableContext>
      <DragOverlay>
        {activeProvider ? (
          <Badge
            size="lg"
            variant={activeIndex === 0 ? 'filled' : 'light'}
            color={activeIndex === 0 ? 'blue' : 'gray'}
            radius="md"
            style={{
              cursor: 'grabbing',
              paddingLeft: 8,
              paddingRight: 10,
              fontWeight: 500,
              boxShadow: 'var(--mantine-shadow-md)',
              width: BADGE_WIDTH,
              minWidth: BADGE_WIDTH,
              justifyContent: 'flex-start',
            }}
          >
            <Group gap={6} wrap="nowrap">
              <Box
                component="span"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  fontSize: '11px',
                  fontWeight: 700,
                  opacity: 0.8,
                  borderRadius: '50%',
                  backgroundColor: activeIndex === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                }}
              >
                {activeIndex + 1}
              </Box>
              <Box component="span" style={{ fontSize: '13px', textTransform: 'uppercase' }}>{activeProvider}</Box>
            </Group>
          </Badge>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

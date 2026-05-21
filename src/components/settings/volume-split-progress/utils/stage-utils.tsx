/**
 * Utility functions for stage management
 */
import React from 'react';

import {
  IconCheck,
  IconAlertCircle,
  IconPhoto,
  IconSearch,
  IconChartBar,
  IconFileText,
  IconClock
} from '@tabler/icons-react';

import type { SplitStage } from '@/hooks/useVolumeSplitProgress';

/**
 * Get icon for split stage
 */
export function getStageIcon(stage: SplitStage): React.ReactElement {
  switch (stage) {
    case 'initializing':
      return <IconClock size={16} />;
    case 'extracting_images':
      return <IconPhoto size={16} />;
    case 'detecting_chapters':
      return <IconSearch size={16} />;
    case 'calculating_confidence':
      return <IconChartBar size={16} />;
    case 'creating_chapters':
      return <IconFileText size={16} />;
    case 'complete':
      return <IconCheck size={16} />;
    case 'error':
      return <IconAlertCircle size={16} />;
    default:
      return <IconClock size={16} />;
  }
}

/**
 * Get color for split stage
 */
export function getStageColor(stage: SplitStage): string {
  switch (stage) {
    case 'initializing':
      return 'gray';
    case 'extracting_images':
      return 'blue';
    case 'detecting_chapters':
      return 'grape';
    case 'calculating_confidence':
      return 'orange';
    case 'creating_chapters':
      return 'cyan';
    case 'complete':
      return 'green';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get stage progression order
 */
export function getStageOrder(): SplitStage[] {
  return [
    'initializing',
    'extracting_images',
    'detecting_chapters',
    'calculating_confidence',
    'creating_chapters'
  ];
}

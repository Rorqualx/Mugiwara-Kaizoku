// Types for Mantine Components with updated props
import type { ComponentPropsWithRef } from 'react';

import type { MantineTheme } from '@mantine/core';

export interface GroupProps extends ComponentPropsWithRef<'div'> {
  position?: 'left' | 'center' | 'right' | 'apart' | 'center';
  spacing?: number | string;
  align?: string;
  noWrap?: boolean;
  grow?: boolean;
}

export interface StackProps extends ComponentPropsWithRef<'div'> {
  spacing?: number | string;
  align?: string;
  justify?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around';
}

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  leftSection?: React.ReactNode;
  color?: string;
  variant?: string;
  loading?: boolean;
  size?: string;
  fullWidth?: boolean;
}

export interface LoadingOverlayProps {
  visible: boolean;
  blur?: number;
}

export interface TextProps extends ComponentPropsWithRef<'p'> {
  size?: string;
  weight?: number | string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  lineClamp?: number;
}

export interface MantineCustomTheme extends MantineTheme {
  colorScheme: string;
}

export interface ActionBarProps {
  children: React.ReactNode;
}

export interface HomeActionBarProps {
  onRefresh: () => void;
  refreshing: boolean;
}

// Types for ProwlarrContext
export interface ProwlarrContextType {
  api: {
    getSystemStatus: () => Promise<unknown>;
    getIndexers: () => Promise<unknown[]>;
  } | null;
  connectionStatus: string;
  testConnection: () => Promise<void>;
  error?: string;
}

// Event Data Types
export interface EventListItem {
  id: string;
  level: string;
  message: string;
  timestamp: string | Date;
  details?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface EventModalDetails {
  mangaTitle?: string;
  chapterTitle?: string;
  libraryName?: string;
  jobType?: string;
  error?: string;
  stack?: string;
}
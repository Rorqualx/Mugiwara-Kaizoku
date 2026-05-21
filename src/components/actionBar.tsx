import React from "react";

import { Paper } from '@mantine/core';

import type { ActionBarProps } from '../types/components';

export function ActionBar({ children }: ActionBarProps): React.JSX.Element {
  return (
    <Paper withBorder p="sm" shadow="sm" mb="sm">
      {children}
    </Paper>
  );
}
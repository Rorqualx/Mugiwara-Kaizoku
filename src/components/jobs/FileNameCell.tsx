/** Clickable file-name cell used in every Jobs table row. */
import React from 'react';

import { Text, UnstyledButton } from '@mantine/core';

const FILE_NAME_BUTTON_STYLE: React.CSSProperties = { width: '100%', textAlign: 'left' };
const FILE_NAME_TEXT_STYLE: React.CSSProperties = {
  color: '#c0caf5',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: 3,
};

export interface FileNameCellProps {
  fileName: string;
  size?: 'xs' | 'sm';
  onClick: () => void;
}

export function FileNameCell({ fileName, size = 'sm', onClick }: FileNameCellProps): React.ReactElement {
  return (
    <UnstyledButton
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={fileName}
      style={FILE_NAME_BUTTON_STYLE}
    >
      <Text size={size} lineClamp={1} style={FILE_NAME_TEXT_STYLE}>{fileName}</Text>
    </UnstyledButton>
  );
}

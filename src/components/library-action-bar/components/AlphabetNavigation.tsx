/**
 * AlphabetNavigation component for quick letter navigation
 */

import React from 'react';

import { Box, Button } from '@mantine/core';

import type { AlphabetNavigationProps } from '../types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

/**
 * Fixed position alphabet navigation sidebar for quickly jumping
 * to manga titles starting with specific letters.
 */
export function AlphabetNavigation({
  onJumpToLetter,
}: AlphabetNavigationProps): React.JSX.Element {
  return (
    <Box
      style={{
        position: 'fixed',
        right: '4px',
        top: 'calc(92px + 2vh)',
        bottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '0px',
        backgroundColor: 'rgba(66, 66, 66, 0.7)',
        padding: '6px 4px',
        borderRadius: '4px',
        zIndex: 101,
        height: 'calc(100vh - 104px + 1vh)',
      }}
    >
      {ALPHABET.map((letter) => (
        <Button
          key={letter}
          variant="subtle"
          size="xs"
          onClick={() => onJumpToLetter(letter)}
          style={{
            minWidth: '24px',
            height: '16px',
            padding: '0 4px',
            fontSize: '11px',
            fontWeight: 500,
            margin: '0px',
          }}
        >
          {letter}
        </Button>
      ))}
    </Box>
  );
}

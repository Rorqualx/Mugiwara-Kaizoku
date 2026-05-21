import React from 'react';

import { IconArrowRight, IconBook, IconFile, IconMusic } from '@tabler/icons-react';

export function formatIcon(format: string): React.ReactElement {
  switch (format.toLowerCase()) {
    case 'cbz':
    case 'cbr':
    case 'zip':
    case 'pdf':
      return <IconFile size={20} />;
    case 'epub':
    case 'mobi':
    case 'azw3':
      return <IconBook size={20} />;
    case 'mp3':
    case 'm4a':
    case 'm4b':
    case 'aac':
    case 'flac':
    case 'alac':
    case 'wav':
    case 'ogg':
      return <IconMusic size={20} />;
    default:
      return <IconArrowRight size={20} />;
  }
}

export const ebookFormatOptions = [
  { value: 'epub', label: 'EPUB - Electronic Publication' },
  { value: 'cbz', label: 'CBZ - Comic Book Archive' }
];

export const audiobookFormatOptions = [
  { value: 'm4b', label: 'M4B - Audiobook with chapters' },
  { value: 'mp3', label: 'MP3 - Universal audio' },
  { value: 'flac', label: 'FLAC - Lossless audio' },
  { value: 'm4a', label: 'M4A - AAC audio' },
  { value: 'aac', label: 'AAC - Advanced audio' },
  { value: 'alac', label: 'ALAC - Apple lossless' },
  { value: 'wav', label: 'WAV - Uncompressed audio' },
  { value: 'ogg', label: 'OGG - Vorbis audio' }
];

export function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

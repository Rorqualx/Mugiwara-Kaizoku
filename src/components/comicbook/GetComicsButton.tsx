/**
 * GetComicsButton — single-purpose trigger that opens the GetComics search
 * modal for a comicbook series. Visible only when `mediaType=COMICBOOK`
 * AND the comicbook-tracking feature flag is on. Renders nothing otherwise,
 * so callers can drop it into the manga detail toolbar unconditionally.
 */

import React, { useState } from 'react';

import { Button } from '@mantine/core';
import { IconCloudDownload } from '@tabler/icons-react';

import { useComicvineConfig } from '@/hooks/useComicvineConfig';

import { GetComicsModal } from './GetComicsModal';

interface GetComicsButtonProps {
  mangaId: number;
  mangaTitle: string;
  mediaType: string | null | undefined;
  /** Optional issue number (chapterNumber on the Chapter row) for path/labelling. */
  issueNumber?: number | null;
}

export function GetComicsButton(props: GetComicsButtonProps): React.ReactElement | null {
  const { mangaId, mangaTitle, mediaType, issueNumber } = props;
  const [opened, setOpened] = useState(false);
  const { config } = useComicvineConfig();

  if (mediaType !== 'COMICBOOK' || !config.comicbookTrackingEnabled) {
    return null;
  }

  return (
    <>
      <Button
        variant="light"
        color="indigo"
        size="sm"
        leftSection={<IconCloudDownload size={16} />}
        onClick={() => setOpened(true)}
      >
        Find on GetComics
      </Button>
      <GetComicsModal
        opened={opened}
        onClose={() => setOpened(false)}
        mangaId={mangaId}
        mangaTitle={mangaTitle}
        {...(typeof issueNumber === 'number' ? { issueNumber } : {})}
      />
    </>
  );
}

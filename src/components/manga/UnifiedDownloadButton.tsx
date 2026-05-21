import React, { useState } from 'react';

import { Button, Menu, Text, Loader } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import { IconDownload, IconChevronDown, IconServer, IconCloud, IconLink, IconCheck } from '@tabler/icons-react';



// MANGAL_SUPPORTED_SOURCES removed - mangal is deprecated
import { notify } from '@/utils/notify';

import { DownloadOptionsModal } from './DownloadOptionsModal';

import type { Manga as MangaEntity } from '@prisma/client';
import type { Chapter as ChapterEntity } from '@prisma/client';
interface UnifiedDownloadButtonProps {
  manga: MangaEntity;
  chapter: ChapterEntity;
  onSuccess?: () => void;
}
export function UnifiedDownloadButton({
  manga,
  chapter,
  onSuccess: _onSuccess
}: UnifiedDownloadButtonProps): React.ReactElement {
  const [showModal, setShowModal] = useState(false);

  // Check download status
  const isDownloaded = chapter.downloadStatus === ChapterStatus.COMPLETED;
  const isDownloading$ = chapter.downloadStatus === ChapterStatus.DOWNLOADING;

  // For already downloaded chapters
  if (isDownloaded) {
    return <Button size="xs" variant="light" color="green" leftSection={<IconCheck size={14} />} disabled>

        Downloaded
      </Button>;
  }

  // For currently downloading chapters
  if (isDownloading$) {
    return <Button size="xs" variant="light" leftSection={<Loader size={14} color="blue" />} disabled>

        Downloading...
      </Button>;
  }

  // Note: Mangal direct download is deprecated, removed dead code

  // Menu for all sources with multiple download options
  return <>
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button size="xs" variant="light" rightSection={<IconChevronDown size={14} />} leftSection={<IconDownload size={14} />}>

            Download
          </Button>
        </Menu.Target>
        
        <Menu.Dropdown>
          <Menu.Label>Download Options</Menu.Label>
          
          <Menu.Item leftSection={<IconCloud size={14} />} onClick={() => setShowModal(true)}>

            <div>
              <Text size="sm">Via Download Client</Text>
              <Text size="xs" c="dimmed">Search with Prowlarr</Text>
            </div>
          </Menu.Item>
          
          <Menu.Item leftSection={<IconLink size={14} />} onClick={() => {
          notify({ severity: 'INFO', title: 'Direct URL', message: 'Direct URL download coming soon' });
        }}>

            <div>
              <Text size="sm">Direct URL</Text>
              <Text size="xs" c="dimmed">Paste a download link</Text>
            </div>
          </Menu.Item>
          
          <Menu.Divider />
          
          <Menu.Item leftSection={<IconServer size={14} />} disabled c="dimmed">

            <div>
              <Text size="sm">Direct Download</Text>
              <Text size="xs" c="dimmed">Not available for {manga["source"]}</Text>
            </div>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      
      <DownloadOptionsModal opened={showModal} onClose={() => setShowModal(false)} manga={manga} chapters={[chapter]} />

    </>;
}
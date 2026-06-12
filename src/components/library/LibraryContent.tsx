/**
 * Library Content Component
 * 
 * This component handles switching between different view types (poster, table, detailed)
 * based on the library view store state.
 * 
 * @module components/library/LibraryContent
 */

import React from 'react';

import { useLibraryViewStore } from '@/store/index';
import type { MangaWithRelations } from '@/types/search.types';

import { PosterView } from './views/PosterView';
import { ResponsiveDetailedView } from './views/ResponsiveDetailedView';
import { ResponsiveTableView } from './views/ResponsiveTableView';

interface LibraryContentProps {
  manga: MangaWithRelations[];
  libraryId: number;
  onRefresh: () => void;
  /** ScrollArea viewport ref — forwarded to PosterView and the detailed view for row virtualization. */
  scrollParentRef?: React.RefObject<HTMLElement | null>;
}

export function LibraryContent(props: LibraryContentProps): React.ReactElement {
  const viewType = useLibraryViewStore((state) => state.viewType);
  const { scrollParentRef, ...rest } = props;

  switch (viewType) {
    case 'table':
      return <ResponsiveTableView {...rest} />;
    case 'details':
      return scrollParentRef
        ? <ResponsiveDetailedView {...rest} scrollParentRef={scrollParentRef} />
        : <ResponsiveDetailedView {...rest} />;
    case 'posters':
    default:
      return scrollParentRef
        ? <PosterView {...rest} scrollParentRef={scrollParentRef} />
        : <PosterView {...rest} />;
  }
}
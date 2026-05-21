/**
 * Add Comic Page
 *
 * Search ComicVine for a comicbook series and add it to the library.
 * The page is a thin wrapper around `AddComicWizard`.
 */

import React from 'react';
import type { ReactElement } from 'react';

import { AddComicWizard } from '@/components/addComic/AddComicWizard';
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';

export default function AddComicPage(): React.ReactElement {
  return <AddComicWizard />;
}

AddComicPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};

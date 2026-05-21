// Reader Page - Native manga reader
import React, { useEffect } from 'react';

// GetServerSideProps type for Next.js 14
import Head from 'next/head';
import { getServerSession } from 'next-auth/next';

import { NativeReader } from '@/components/reader/NativeReader';
import { authOptions } from '@/lib/auth';
import { useReaderStore } from '@/store/readerSlice';

import type { GetServerSidePropsContext } from 'next';

interface ReadPageProps {
  mangaId: string;
  chapterId: string;
}

export default function ReadPage({ mangaId: _mangaId, chapterId: _chapterId }: ReadPageProps): JSX.Element {
  const reset = useReaderStore((state) => state.reset);

  // Reset reader state on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <>
      <Head>
        <title>Mugiwara Reader</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      
      <NativeReader />
    </>);

}

// No layout for reader pages
ReadPage.getLayout = (page: React.ReactElement) => page;

export const getServerSideProps = async (ctx: GetServerSidePropsContext<{ mangaId: string; chapterId: string }>): Promise<
  | { props: { mangaId: string; chapterId: string } }
  | { redirect: { destination: string; permanent: boolean } }
  | { notFound: true }
> => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false
      }
    };
  }

  const { mangaId, chapterId } = ctx.params ?? { mangaId: '', chapterId: '' };

  if (!mangaId || !chapterId) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      mangaId,
      chapterId
    }
  };
};
/**
 * Jobs Index — redirects to the unified Jobs page.
 */

import { useEffect } from 'react';

import { useRouter } from 'next/router';

export default function JobsIndex(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    void router.replace('/jobs/active');
  }, [router]);

  return <></>;
}

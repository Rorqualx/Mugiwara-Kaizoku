/**
 * Users Settings Page Redirect
 * 
 * Legacy route handler that redirects from /settings/users to /system/users.
 * Implements a permanent (301) redirect for SEO purposes and maintains
 * backward compatibility with old URLs.
 * 
 * @module pages/settings/users
 * @requires next
 */

/**
 * Empty component for the redirect page
 * Next.js requires a default export even for redirect-only pages
 * 
 * @returns {null} Renders nothing as page redirects
 */
export default function UsersRedirectPage(): React.ReactElement {
  return <></>;
}

/**
 * Server-side redirect handler
 * Implements a permanent redirect to the new users management location
 * 
 * @type {GetServerSideProps}
 * @returns {Promise<{redirect: {destination: string, permanent: boolean}}>}
 */
export const getServerSideProps = (): { props: Record<string, never> } | { redirect: { destination: string; permanent: boolean } } => {
  return {
    redirect: {
      destination: '/system/users',
      permanent: true, // Use permanent redirect for SEO
    },
  };
};

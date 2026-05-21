/**
 * Legacy Users Page Redirect
 * 
 * Handles redirection from the old users page URL (/systems/users)
 * to the new location (/system/users). This ensures backward compatibility
 * and proper SEO handling through permanent redirects.
 * 
 * @module pages/systems/users
 * @requires next - GetServerSideProps type
 */

/**
 * Users Redirect Component
 * 
 * Empty component that never renders since getServerSideProps
 * will always redirect to the new location.
 * 
 * @component
 * @returns {null} Component returns null as it never renders
 */
export default function UsersRedirectPage(): React.ReactElement {
  return <></>;
}

/**
 * Server-side Props Handler
 * 
 * Performs permanent redirection to the new users page location.
 * Uses 308 Permanent Redirect for optimal SEO handling.
 * 
 * @returns {Promise<Object>} Redirect configuration
 */
export const getServerSideProps = (): { props: Record<string, never> } | { redirect: { destination: string; permanent: boolean } } => {
  // Redirect to the new users page location
  return {
    redirect: {
      destination: '/system/users',
      permanent: true, // Use permanent redirect for SEO
    },
  };
};

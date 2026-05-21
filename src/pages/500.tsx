/**
 * 500 Internal Server Error Page
 * 
 * Custom error page for handling server-side errors.
 * Provides a user-friendly interface for internal server errors
 * with clear messaging and navigation options.
 * 
 * Features:
 * - Responsive design
 * - Clear error messaging
 * - User guidance
 * - Home page navigation
 * - Dark theme styling
 * 
 * @module pages/500
 * @requires react - React core
 * @requires next/link - Navigation components
 */

import React from 'react';

import Link from 'next/link';

/**
 * 500 Error Page Component
 * 
 * Renders a user-friendly error page for internal server errors.
 * Includes informative messaging and a navigation button to return home.
 * Uses inline styles for consistent error page appearance.
 * 
 * Design Features:
 * - Centered layout
 * - Dark theme colors
 * - Responsive text sizing
 * - Clear call to action
 * 
 * @component
 * @example
 * ```tsx
 * // Automatically handled by Next.js for 500 errors
 * // Can also be manually rendered:
 * <Error500Page />
 * ```
 * @returns {React.ReactElement} Error page with message and navigation
 */
export default function Error500Page(): React.ReactElement {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#333333',
      color: '#C1C2C5'
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          marginBottom: '1.5rem',
          fontWeight: 900,
          color: '#fff'
        }}>
          Something went wrong
        </h1>
        
        <p style={{
          fontSize: '1.125rem',
          marginBottom: '2rem',
          lineHeight: 1.6,
          color: '#909296'
        }}>
          We apologize, but our server encountered an unexpected error.
          Our team has been notified and is working to fix the issue.
          Please try again later or contact support if the problem persists.
        </p>

        <Link href="/">
          <span
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#228BE6',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Return to home page
          </span>
        </Link>
      </div>
    </div>
  );
}

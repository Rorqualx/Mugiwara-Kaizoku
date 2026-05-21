/**
 * Mock implementation of DefaultMetadataProvider component for build compatibility
 * 
 * This is a simplified mock version of the component for use during build
 * to prevent dependency errors.
 */
import React from 'react';
export function DefaultMetadataProvider(): React.ReactElement {
  return <div data-testid="default-metadata-provider">Mock DefaultMetadataProvider</div>;
}

export default DefaultMetadataProvider;

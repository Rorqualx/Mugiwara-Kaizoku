/**
 * Mock implementation of the SourceTester component
 * Used for testing and fallback purposes
 */
import React from 'react';

import { Text } from '@mantine/core';
export function SourceTester(props: { sourceName?: string }): React.ReactElement {
  return (
    <Text>Source Tester Mock for {props.sourceName || 'default source'}</Text>
  );
}

export default SourceTester;

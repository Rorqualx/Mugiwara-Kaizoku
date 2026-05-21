/**
 * Validation Feedback Panel Component
 *
 * Displays validation feedback including:
 * - Safety issues (blocking errors)
 * - Warnings (non-blocking)
 * - Suggestions for improvement
 *
 * @module components/shared/annotation/visual-inspector/components/ValidationFeedbackPanel
 */

import { Alert, Stack } from '@mantine/core';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

import type { ValidationFeedbackPanelProps } from '../types';

/**
 * Panel showing validation warnings, suggestions, and safety issues
 */
export function ValidationFeedbackPanel({
  warnings,
  suggestions,
  safetyIssues
}: ValidationFeedbackPanelProps): React.ReactElement | null {
  // Return null if no feedback to display
  if (warnings.length === 0 && suggestions.length === 0 && safetyIssues.length === 0) {
    return null;
  }

  return (
    <Stack gap="xs">
      {/* Safety Issues - Red alerts (blocking) */}
      {safetyIssues.map((issue, index) => (
        <Alert
          key={`safety-${index}`}
          icon={<IconAlertTriangle size={16} />}
          color="red"
          variant="light"
          title="Security Issue"
        >
          {issue}
        </Alert>
      ))}

      {/* Warnings - Yellow alerts */}
      {warnings.map((warning, index) => (
        <Alert
          key={`warning-${index}`}
          icon={<IconAlertCircle size={16} />}
          color="yellow"
          variant="light"
          title="Warning"
        >
          {warning}
        </Alert>
      ))}

      {/* Suggestions - Blue alerts */}
      {suggestions.map((suggestion, index) => (
        <Alert
          key={`suggestion-${index}`}
          icon={<IconInfoCircle size={16} />}
          color="blue"
          variant="light"
          title="Suggestion"
        >
          {suggestion}
        </Alert>
      ))}
    </Stack>
  );
}

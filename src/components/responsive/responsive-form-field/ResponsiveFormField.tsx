/**
 * Responsive Form Field Component
 *
 * A wrapper component that provides responsive layouts for form fields:
 * - Responsive label positioning
 * - Touch-friendly spacing
 * - Error message handling
 * - Required field indicators
 */

import React from 'react';

import { useBreakpoint } from '@/hooks/mobile';

import { FieldDescription } from './FieldDescription';
import { FieldError } from './FieldError';
import { FieldLabel } from './FieldLabel';
import { HorizontalLayout } from './HorizontalLayout';
import { VerticalLayout } from './VerticalLayout';

import type { ResponsiveFormFieldProps } from './types';

export function ResponsiveFormField({
  label,
  description,
  required = false,
  error,
  tooltip,
  children,
  labelPosition = 'top',
  labelWidth = 200,
  showRequiredIndicator = true,
  requiredText = 'Required',
  mobileLayout = 'vertical',
  labelProps = {}
}: ResponsiveFormFieldProps): React.ReactElement {
  const { isMobile, isTablet } = useBreakpoint();

  // Determine layout based on device
  const layout = React.useMemo(() => {
    if (isMobile) return mobileLayout;
    if (isTablet) return 'vertical';
    return labelPosition;
  }, [isMobile, isTablet, mobileLayout, labelPosition]);

  // Build sub-components
  const labelComponent = (
    <FieldLabel
      label={label}
      required={required}
      showRequiredIndicator={showRequiredIndicator}
      requiredText={requiredText}
      tooltip={tooltip}
      labelProps={labelProps}
      isMobile={isMobile}
    />
  );

  const descriptionComponent = (
    <FieldDescription
      description={description}
      isMobile={isMobile}
      layout={layout}
    />
  );

  const errorComponent = (
    <FieldError
      error={error}
      isMobile={isMobile}
    />
  );

  // Vertical layout (mobile default)
  if (layout === 'vertical') {
    return (
      <VerticalLayout
        isMobile={isMobile}
        labelComponent={labelComponent}
        descriptionComponent={descriptionComponent}
        errorComponent={errorComponent}
      >
        {children}
      </VerticalLayout>
    );
  }

  // Horizontal layout (desktop)
  return (
    <HorizontalLayout
      isMobile={isMobile}
      labelWidth={labelWidth}
      labelComponent={labelComponent}
      descriptionComponent={descriptionComponent}
      errorComponent={errorComponent}
    >
      {children}
    </HorizontalLayout>
  );
}

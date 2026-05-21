/**
 * Responsive Form Component
 *
 * Enhanced form wrapper that provides mobile-optimized layouts and interactions:
 * - Responsive field layouts
 * - Touch-friendly input spacing
 * - Mobile keyboard handling
 * - Sticky submit buttons on mobile
 */

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';

import {
  Box,
  Stack,
  Group,
  Button,
  Paper,
  Affix,
  Transition,
  rem
} from '@mantine/core';
import { useWindowScroll } from '@mantine/hooks';

import { useBreakpoint } from '@/hooks/mobile';

interface ResponsiveFormProps {
  /** Form content */
  children: React.ReactNode;
  /** Form submission handler */
  onSubmit?: (e: React.FormEvent) => void;
  /** Submit button text */
  submitLabel?: string;
  /** Cancel button text */
  cancelLabel?: string;
  /** Cancel handler */
  onCancel?: () => void;
  /** Whether form is submitting */
  isSubmitting?: boolean;
  /** Whether to show sticky buttons on mobile */
  stickyMobileButtons?: boolean;
  /** Custom submit button */
  customSubmitButton?: React.ReactNode;
  /** Form layout direction */
  layout?: 'vertical' | 'horizontal';
  /** Field spacing */
  spacing?: string | number;
  /** Mobile-specific spacing */
  mobileSpacing?: string | number;
  /** Whether to add padding */
  withPadding?: boolean;
  /** Custom form styles */
  formStyles?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Sub-components extracted to reduce complexity
// ---------------------------------------------------------------------------

interface FormButtonGroupProps {
  isMobile: boolean;
  onCancel?: (() => void) | undefined;
  isSubmitting: boolean;
  cancelLabel: string;
  submitLabel: string;
  customSubmitButton?: React.ReactNode;
}

function FormButtonGroup({
  isMobile,
  onCancel,
  isSubmitting,
  cancelLabel,
  submitLabel,
  customSubmitButton
}: FormButtonGroupProps): React.JSX.Element {
  const buttonSize = isMobile ? 'md' : 'lg';

  return (
    <Group
      justify={isMobile ? 'center' : 'flex-end'}
      mt={isMobile ? 'md' : 'lg'}
      gap={isMobile ? 'xs' : 'sm'}
    >
      {onCancel && (
        <Button
          variant="subtle"
          onClick={onCancel}
          disabled={isSubmitting}
          size={buttonSize}
          fullWidth={isMobile}
        >
          {cancelLabel}
        </Button>
      )}

      {customSubmitButton ?? (
        <Button
          type="submit"
          loading={isSubmitting}
          size={buttonSize}
          fullWidth={isMobile}
        >
          {submitLabel}
        </Button>
      )}
    </Group>
  );
}

interface StickyButtonAffixProps {
  showStickyButtons: boolean;
  children: React.ReactNode;
}

function StickyButtonAffix({
  showStickyButtons,
  children
}: StickyButtonAffixProps): React.JSX.Element | null {
  if (!showStickyButtons) return null;

  return (
    <Affix position={{ bottom: 0, left: 0, right: 0 }}>
      <Transition transition="slide-up" mounted={showStickyButtons}>
        {(transitionStyles): React.JSX.Element => (
          <Paper
            p="sm"
            shadow="xl"
            style={{
              ...transitionStyles,
              borderTop: '1px solid var(--mantine-color-dark-4)',
              backgroundColor: 'var(--mantine-color-dark-7)',
              borderRadius: 0
            }}
          >
            {children}
          </Paper>
        )}
      </Transition>
    </Affix>
  );
}

// ---------------------------------------------------------------------------
// Custom hook for sticky button logic
// ---------------------------------------------------------------------------

function useStickyButtons(
  stickyMobileButtons: boolean,
  isMobile: boolean,
  formRef: React.RefObject<HTMLFormElement | null>
): boolean {
  const [showStickyButtons, setShowStickyButtons] = useState(false);
  const [scroll] = useWindowScroll();

  useEffect(() => {
    if (!stickyMobileButtons || !isMobile) {
      setShowStickyButtons(false);
      return;
    }

    if (!formRef.current) {
      setShowStickyButtons(false);
      return;
    }

    const formRect = formRef.current.getBoundingClientRect();
    const formBottom = formRect.bottom;
    const viewportHeight = window.innerHeight;
    const threshold = 100;

    setShowStickyButtons(formBottom > viewportHeight - threshold);
  }, [stickyMobileButtons, isMobile, scroll, formRef]);

  return showStickyButtons;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResponsiveForm({
  children,
  onSubmit,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  onCancel,
  isSubmitting = false,
  stickyMobileButtons = true,
  customSubmitButton,
  layout: _layout = 'vertical',
  spacing = 'md',
  mobileSpacing,
  withPadding = true,
  formStyles
}: ResponsiveFormProps): React.JSX.Element {
  const { isMobile } = useBreakpoint();
  const formRef = useRef<HTMLFormElement>(null);
  const showStickyButtons = useStickyButtons(stickyMobileButtons, isMobile, formRef);

  const responsiveSpacing = useMemo((): string | number => {
    if (isMobile && mobileSpacing !== undefined) return mobileSpacing;
    if (isMobile) return 'sm';
    return spacing;
  }, [spacing, mobileSpacing, isMobile]);

  const handleSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault();
    onSubmit?.(e);
  }, [onSubmit]);

  const formPadding = withPadding ? (isMobile ? 'sm' : 'md') : 0;
  const shouldShowInlineButtons = !isMobile || !showStickyButtons;
  const shouldShowStickyButtons = isMobile && showStickyButtons;

  const buttonGroupProps: FormButtonGroupProps = {
    isMobile,
    onCancel,
    isSubmitting,
    cancelLabel,
    submitLabel,
    customSubmitButton
  };

  return (
    <>
      <Box
        component="form"
        ref={formRef}
        onSubmit={handleSubmit}
        style={{
          ...formStyles,
          paddingBottom: shouldShowStickyButtons ? rem(80) : undefined
        }}
      >
        <Stack gap={responsiveSpacing} p={formPadding}>
          {children}
          {shouldShowInlineButtons && <FormButtonGroup {...buttonGroupProps} />}
        </Stack>
      </Box>

      {shouldShowStickyButtons && (
        <StickyButtonAffix showStickyButtons={showStickyButtons}>
          <FormButtonGroup {...buttonGroupProps} />
        </StickyButtonAffix>
      )}
    </>
  );
}
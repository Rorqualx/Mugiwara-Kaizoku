/**
 * Data Correction Panel
 *
 * Interactive UI for users to correct extracted metadata and train the ML engine.
 * Provides inline editing with visual feedback and confidence indicators.
 *
 * Decomposed from the original monolithic component for better maintainability.
 */
import React from 'react';

import { Card, Stack, Collapse, Container } from '@mantine/core';

import {
  PanelHeader,
  TeachingModeAlert,
  QuickActions,
  FieldEditor,
  CorrectionsSummary,
  PatternDetails,
  ConfidenceSlider,
  ActionButtons,
} from './components';
import { useDataCorrection } from './hooks';
import { PRIMARY_FIELDS, getConfidenceColor } from './utils';

import type { CorrectionPanelProps } from './types';

export const DataCorrectionPanel: React.FC<CorrectionPanelProps> = ({
  originalData,
  mlConfidence,
  patternsUsed,
  url,
  onSubmitCorrections,
  onSkip,
  showAdvanced = false,
}): JSX.Element => {
  const {
    correctedData,
    editMode,
    setEditMode,
    corrections,
    userConfidence,
    setUserConfidence,
    showDetails,
    setShowDetails,
    isSubmitting,
    validationErrors,
    teachingMode,
    setTeachingMode,
    showPatternDetails,
    setShowPatternDetails,
    handleFieldCorrection,
    handleSubmit,
    handleAutoSuggest,
    resetData,
  } = useDataCorrection({
    originalData,
    mlConfidence,
    patternsUsed,
    url,
    onSubmitCorrections,
  });

  const renderFieldEditor = (field: string): JSX.Element | null => {
    if (!Object.hasOwn(originalData, field)) {
      return null;
    }

    const fieldError = validationErrors[field];
    return (
      <FieldEditor
        key={field}
        field={field}
        value={correctedData[field]}
        originalValue={originalData[field]}
        hasCorrection={Boolean(corrections[field])}
        error={fieldError}
        isEditing={editMode[field] ?? false}
        onToggleEdit={() =>
          setEditMode((prev) => ({ ...prev, [field]: !prev[field] }))
        }
        onFieldChange={handleFieldCorrection}
      />
    );
  };

  return (
    <Container size="lg">
      <Card shadow="sm" p="lg" radius="md">
        <PanelHeader mlConfidence={mlConfidence} />

        <TeachingModeAlert
          teachingMode={teachingMode}
          onTeachingModeChange={setTeachingMode}
        />

        <QuickActions
          onAutoSuggest={handleAutoSuggest}
          onReset={resetData}
          showDetails={showDetails}
          onToggleDetails={() => setShowDetails(!showDetails)}
        />

        {/* Main Fields */}
        <Stack gap="md">
          {PRIMARY_FIELDS.map((field) => renderFieldEditor(field))}

          {/* Collapsible advanced fields */}
          <Collapse in={showDetails}>
            <Stack gap="md">
              {Object.keys(correctedData)
                .filter((field) => !PRIMARY_FIELDS.includes(field as (typeof PRIMARY_FIELDS)[number]))
                .map((field) => renderFieldEditor(field))}
            </Stack>
          </Collapse>
        </Stack>

        <CorrectionsSummary
          correctionsCount={Object.keys(corrections).length}
          teachingMode={teachingMode}
        />

        {showAdvanced && (
          <PatternDetails
            patternsUsed={patternsUsed}
            url={url}
            showPatternDetails={showPatternDetails}
            onTogglePatternDetails={() => setShowPatternDetails(!showPatternDetails)}
          />
        )}

        {teachingMode && (
          <ConfidenceSlider
            userConfidence={userConfidence}
            onConfidenceChange={setUserConfidence}
            getConfidenceColor={getConfidenceColor}
          />
        )}

        <ActionButtons
          onSkip={onSkip}
          onReset={resetData}
          onSubmit={() => {
            void handleSubmit();
          }}
          isSubmitting={isSubmitting}
          hasCorrections={Object.keys(corrections).length > 0}
          hasErrors={Object.keys(validationErrors).length > 0}
          teachingMode={teachingMode}
        />
      </Card>
    </Container>
  );
};

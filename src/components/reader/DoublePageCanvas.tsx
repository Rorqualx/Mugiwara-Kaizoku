// DoublePageCanvas component for side-by-side page display
import React, { useState, useCallback } from 'react';

import { Box, LoadingOverlay } from '@mantine/core';

import type { ReaderSettings } from '@/types/reader/reader-types';
import { logger } from '@/utils/logger';
import { DOUBLE_PAGE_GAP } from '@/utils/reader/constants';

import { PageErrorOverlay } from './PageErrorOverlay';
interface DoublePageCanvasProps {
    leftUrl: string | null;
    rightUrl: string | null;
    settings: ReaderSettings;
    onLoad?: (side: 'left' | 'right') => void;
    currentPage: number;
}
export const DoublePageCanvas = React.memo(function DoublePageCanvas({ leftUrl, rightUrl, settings, onLoad, currentPage }: DoublePageCanvasProps): React.ReactElement {
    const [leftLoaded, setLeftLoaded] = useState(false);
    const [rightLoaded, setRightLoaded] = useState(false);
    const [leftError, setLeftError] = useState(false);
    const [rightError, setRightError] = useState(false);
    const [leftRetryKey, setLeftRetryKey] = useState(0);
    const [rightRetryKey, setRightRetryKey] = useState(0);
    // Reset loading/error states when URLs change
    React.useEffect(() => {
        setLeftLoaded(false);
        setRightLoaded(false);
        setLeftError(false);
        setRightError(false);
    }, [leftUrl, rightUrl]);
    const handleLeftLoad = useCallback(() => {
        setLeftLoaded(true);
        onLoad?.('left');
    }, [onLoad]);
    const handleRightLoad = useCallback(() => {
        setRightLoaded(true);
        onLoad?.('right');
    }, [onLoad]);
    // Determine if we should show loading overlay
    const isLoading = (leftUrl && !leftLoaded) || (rightUrl && !rightLoaded);
    return (<Box className="double-page-container" style={{
            display: 'flex',
            flexDirection: settings.readingDirection === 'rtl' ? 'row-reverse' : 'row',
            gap: DOUBLE_PAGE_GAP,
            backgroundColor: settings.backgroundColor,
            height: '100%',
            width: '100%',
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center'
        }}>

      {isLoading &&
            <LoadingOverlay visible/>}
      
      {/* Left Page */}
      <Box style={{
            flex: 1,
            display: 'flex',
            justifyContent: settings.readingDirection === 'rtl' ? 'flex-start' : 'flex-end',
            alignItems: 'center',
            height: '100%',
            overflow: 'hidden'
        }}>
        {leftUrl ? (
          leftError ? (
            <PageErrorOverlay
              pageNumber={settings.readingDirection === 'rtl' ? currentPage + 1 : currentPage}
              backgroundColor={settings.backgroundColor}
              onRetry={() => {
                setLeftError(false);
                setLeftLoaded(false);
                setLeftRetryKey(prev => prev + 1);
              }}
            />
          ) : (
            <img
              key={`left-${leftRetryKey}`}
              src={leftRetryKey > 0 ? `${leftUrl}?retry=${leftRetryKey}` : leftUrl}
              alt={`Page ${settings.readingDirection === 'rtl' ? currentPage + 1 : currentPage}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: settings.fitMode as React.CSSProperties['objectFit'],
                filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`,
                display: leftLoaded ? 'block' : 'none'
              }}
              onLoad={handleLeftLoad}
              onError={() => {
                logger.error('Failed to load left page');
                setLeftError(true);
                setLeftLoaded(true);
              }}
            />
          )
        ) : (
          <Box style={{ width: '100%', height: '100%', backgroundColor: settings.backgroundColor }} />
        )}
      </Box>
      
      {/* Right Page */}
      <Box style={{
            flex: 1,
            display: 'flex',
            justifyContent: settings.readingDirection === 'rtl' ? 'flex-end' : 'flex-start',
            alignItems: 'center',
            height: '100%',
            overflow: 'hidden'
        }}>
        {rightUrl ? (
          rightError ? (
            <PageErrorOverlay
              pageNumber={settings.readingDirection === 'rtl' ? currentPage : currentPage + 1}
              backgroundColor={settings.backgroundColor}
              onRetry={() => {
                setRightError(false);
                setRightLoaded(false);
                setRightRetryKey(prev => prev + 1);
              }}
            />
          ) : (
            <img
              key={`right-${rightRetryKey}`}
              src={rightRetryKey > 0 ? `${rightUrl}?retry=${rightRetryKey}` : rightUrl}
              alt={`Page ${settings.readingDirection === 'rtl' ? currentPage : currentPage + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: settings.fitMode as React.CSSProperties['objectFit'],
                filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`,
                display: rightLoaded ? 'block' : 'none'
              }}
              onLoad={handleRightLoad}
              onError={() => {
                logger.error('Failed to load right page');
                setRightError(true);
                setRightLoaded(true);
              }}
            />
          )
        ) : (
          <Box style={{ width: '100%', height: '100%', backgroundColor: settings.backgroundColor }} />
        )}
      </Box>
    </Box>);
});

DoublePageCanvas.displayName = 'DoublePageCanvas';

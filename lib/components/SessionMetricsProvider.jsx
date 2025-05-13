/**
 * Session Metrics Provider Component
 * 
 * Provides session metrics recording capability through the Zustand store
 * for use with the tube-stitch model.
 */

import React, { useCallback } from 'react';
import { useZenjinStore } from '../store';

/**
 * Component that provides session metrics recording for player components
 */
const SessionMetricsProvider = ({ 
  children, 
  tubeId,
  stitchId,
  onSessionRecorded
}) => {
  const { recordSession, sessionMetrics } = useZenjinStore();
  
  // Handler for recording session metrics
  const handleRecordSession = useCallback(async (results) => {
    try {
      if (!results || !tubeId || !stitchId) {
        console.error('Missing required data for recording session metrics');
        return null;
      }
      
      // Format the session metrics data
      const metricsData = {
        tubeId,
        stitchId,
        questionResults: Array.isArray(results.results) ? results.results : [],
        sessionDuration: results.sessionDuration || 0
      };
      
      // Record the session using the Zustand store
      const response = await recordSession(metricsData);
      
      // Notify parent component if callback provided
      if (onSessionRecorded && typeof onSessionRecorded === 'function') {
        onSessionRecorded(response);
      }
      
      return response;
    } catch (error) {
      console.error('Error recording session metrics:', error);
      return null;
    }
  }, [tubeId, stitchId, recordSession, onSessionRecorded]);
  
  // Create augmented props for children
  const childProps = {
    recordSession: handleRecordSession,
    isRecordingSession: sessionMetrics?.isRecording || false,
    sessionError: sessionMetrics?.error
  };
  
  // Clone and augment the child element with session metrics props
  return React.cloneElement(children, childProps);
};

export default SessionMetricsProvider;
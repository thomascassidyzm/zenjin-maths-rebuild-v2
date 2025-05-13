/**
 * Session Metrics Hook
 * 
 * Provides a React hook for easily recording session metrics from components
 */

import { useCallback } from 'react';
import { useZenjinStore } from '../store';
import { SessionMetricsData, SessionQuestionResult } from '../store/types';
import { formatQuestionResults } from '../store/sessionActions';

/**
 * Hook for recording session metrics
 * Provides a simplified interface for components to record session data
 */
export const useSessionMetrics = () => {
  const { recordSession, sessionMetrics } = useZenjinStore();
  
  /**
   * Records session metrics using the Zustand store
   */
  const recordSessionMetrics = useCallback(
    async (metrics: SessionMetricsData) => {
      // Ensure question results are in the correct format
      const formattedMetrics = {
        ...metrics,
        questionResults: metrics.questionResults ? 
          formatQuestionResults(metrics.questionResults) : []
      };
      
      return await recordSession(formattedMetrics);
    },
    [recordSession]
  );
  
  /**
   * Prepares session metrics from raw question results
   */
  const prepareSessionMetrics = useCallback(
    (tubeId: number, stitchId: string, results: any, sessionDuration?: number) => {
      // Extract and format results
      const questionResults = Array.isArray(results.results) ? results.results : [];
      
      return {
        tubeId,
        stitchId,
        questionResults: formatQuestionResults(questionResults),
        sessionDuration: sessionDuration || results.sessionDuration || 0
      };
    },
    []
  );
  
  return {
    recordSessionMetrics,
    prepareSessionMetrics,
    isRecording: sessionMetrics?.isRecording || false,
    lastSession: sessionMetrics?.lastSession || null,
    error: sessionMetrics?.error || null
  };
};

export default useSessionMetrics;
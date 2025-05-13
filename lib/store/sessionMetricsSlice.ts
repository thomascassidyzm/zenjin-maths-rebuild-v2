/**
 * Session Metrics Slice for Zustand Store
 * 
 * This file contains the session metrics slice for the Zustand store
 * to integrate session recording with the tube-stitch model.
 */

import { StateCreator } from 'zustand';
import { SessionMetricsData, SessionMetricsState, ZenjinStore } from './types';
import { recordSessionMetrics, createEmergencySessionMetrics, formatQuestionResults } from './sessionActions';

/**
 * Creates the session metrics slice for the Zustand store
 */
export const createSessionMetricsSlice: StateCreator<
  ZenjinStore,
  [],
  [],
  {
    sessionMetrics: SessionMetricsState;
    recordSession: (metrics: SessionMetricsData) => Promise<any>;
  }
> = (set, get) => ({
  // Initial state
  sessionMetrics: {
    isRecording: false,
    lastSession: null,
    error: null
  },
  
  // Record session metrics action
  recordSession: async (metrics: SessionMetricsData) => {
    // Update state to indicate recording in progress
    set(state => ({
      sessionMetrics: {
        ...state.sessionMetrics,
        isRecording: true,
        error: null
      },
      lastUpdated: new Date().toISOString()
    }));
    
    try {
      // If userId is available in store, include it
      const userInfo = get().userInformation;
      if (userInfo?.userId && !metrics.userId) {
        metrics.userId = userInfo.userId;
      }
      
      // Ensure question results are properly formatted
      const standardizedMetrics = {
        ...metrics,
        questionResults: formatQuestionResults(metrics.questionResults || [])
      };
      
      // Attempt to record metrics via API
      const result = await recordSessionMetrics(standardizedMetrics);
      
      // Update store with successful recording
      set(state => ({
        sessionMetrics: {
          isRecording: false,
          lastSession: standardizedMetrics,
          error: null
        },
        lastUpdated: new Date().toISOString()
      }));
      
      // Update learning progress if available
      if (result.totalPoints && get().learningProgress) {
        // Increment points
        get().incrementPoints(result.totalPoints);
        
        // Update blink speed if available
        if (result.blinkSpeed) {
          get().updateBlinkSpeed(result.blinkSpeed);
        }
      }
      
      console.log('Session metrics recorded successfully:', result);
      return result;
    } catch (error) {
      console.error('Failed to record session metrics:', error);
      
      // Generate emergency metrics for offline fallback
      const emergencyResult = createEmergencySessionMetrics(metrics);
      
      // Update store with error
      set(state => ({
        sessionMetrics: {
          isRecording: false,
          lastSession: metrics,
          error: error instanceof Error ? error.message : String(error)
        },
        lastUpdated: new Date().toISOString()
      }));
      
      // Return emergency metrics so UI can still show results
      return emergencyResult;
    }
  }
});

export default createSessionMetricsSlice;
/**
 * Session Metrics Provider Component
 * 
 * Provides session metrics recording capability through the Zustand store
 * for use with the tube-stitch model.
 * 
 * All API calls go through Zustand as the single source of truth.
 */

import React, { useCallback, useEffect } from 'react';
import { useZenjinStore } from '../store';

/**
 * Component that provides session metrics recording for player components
 */
const SessionMetricsProvider = ({ 
  children, 
  tubeId,
  stitchId,
  onSessionRecorded,
  prefetchContent = true
}) => {
  const { 
    recordSession, 
    sessionMetrics, 
    fetchStitch, 
    addStitchToCollection,
    contentCollection 
  } = useZenjinStore();

  // Prefetch content to ensure it's available before recording
  const ensureContentLoaded = useCallback(async () => {
    if (!stitchId) return false;
    
    try {
      console.log('Ensuring content is loaded for stitch:', stitchId);
      
      // Check if content is already in collection
      const existingStitch = contentCollection?.stitches?.[stitchId];
      if (existingStitch && existingStitch.questions && existingStitch.questions.length > 0) {
        console.log('Stitch already loaded in content collection');
        return true;
      }
      
      // Use the Zustand store to fetch stitch content
      console.log('Fetching stitch content through Zustand store');
      const stitch = await fetchStitch(stitchId);
      
      if (!stitch) {
        console.error('Failed to prefetch stitch content for', stitchId);
        return false;
      }
      
      // Verify questions are loaded correctly
      if (!stitch.questions || stitch.questions.length === 0) {
        console.error('Stitch has no questions:', stitchId);
        return false;
      }
      
      // Check for proper distractor format and fix if needed
      const questions = stitch.questions.map(q => {
        // Ensure question has both distractors and distractorChoices
        if (q.distractors && !q.distractorChoices) {
          // Convert object-based format to array format for the player
          q.distractorChoices = [
            { level: 1, distractorText: q.distractors.L1 || '' },
            { level: 2, distractorText: q.distractors.L2 || '' },
            { level: 3, distractorText: q.distractors.L3 || '' }
          ];
          
          // Add optional higher levels if present
          if (q.distractors.L4) {
            q.distractorChoices.push({ level: 4, distractorText: q.distractors.L4 });
          }
          if (q.distractors.L5) {
            q.distractorChoices.push({ level: 5, distractorText: q.distractors.L5 });
          }
        } else if (q.distractorChoices && !q.distractors) {
          // Convert array-based format to object format
          q.distractors = {};
          q.distractorChoices.forEach(choice => {
            if (choice && typeof choice.level === 'number' && choice.distractorText) {
              q.distractors[`L${choice.level}`] = choice.distractorText;
            }
          });
        }
        return q;
      });
      
      // Update the stitch with properly formatted questions
      const updatedStitch = {
        ...stitch,
        questions
      };
      
      // Update content collection with the formatted stitch
      addStitchToCollection(updatedStitch);
      
      console.log('Stitch content loaded and formatted successfully');
      return true;
    } catch (error) {
      console.error('Error ensuring stitch content is loaded:', error);
      return false;
    }
  }, [stitchId, fetchStitch, addStitchToCollection, contentCollection]);
  
  // Run content prefetch on mount if enabled
  useEffect(() => {
    if (prefetchContent) {
      ensureContentLoaded();
    }
  }, [prefetchContent, ensureContentLoaded]);
  
  // Handler for recording session metrics
  const handleRecordSession = useCallback(async (results) => {
    try {
      if (!results || !tubeId || !stitchId) {
        console.error('Missing required data for recording session metrics');
        return null;
      }
      
      // First ensure content is available if needed
      if (prefetchContent) {
        const contentReady = await ensureContentLoaded();
        if (!contentReady) {
          console.warn('Content not ready, attempting to record session anyway');
        }
      }
      
      // Format the session metrics data
      const metricsData = {
        tubeId,
        stitchId,
        questionResults: Array.isArray(results.results) ? results.results : [],
        sessionDuration: results.sessionDuration || 0
      };
      
      console.log('Recording session metrics through Zustand store');
      
      // Record the session using the Zustand store (single source of truth)
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
  }, [tubeId, stitchId, prefetchContent, ensureContentLoaded, recordSession, onSessionRecorded]);
  
  // Create augmented props for children
  const childProps = {
    recordSession: handleRecordSession,
    ensureContentLoaded,
    isRecordingSession: sessionMetrics?.isRecording || false,
    sessionError: sessionMetrics?.error,
    contentReady: !!contentCollection?.stitches?.[stitchId]
  };
  
  // Clone and augment the child element with session metrics props
  return React.cloneElement(children, childProps);
};

export default SessionMetricsProvider;
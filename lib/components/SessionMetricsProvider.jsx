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
        // Create a properly structured question with exact key mapping
        // Use consistent field naming with player component expectations
        const normalizedQuestion = {
          ...q, // Preserve all original fields
          
          // Map fields explicitly to match the expected format from distinction-learning.ts
          id: q.id,
          text: q.text || q.questionText, // The player expects 'text' not 'questionText'
          correctAnswer: q.correctAnswer, // This is the key field we need to preserve
          
          // Log if critical fields are missing
          ...((!q.text && !q.questionText) && console.error('Question missing text field:', q))
        };
        
        console.log('DEBUG: Processing question:', normalizedQuestion.id, 
          'Has correctAnswer:', !!normalizedQuestion.correctAnswer);
        
        // Ensure question has both distractors and distractorChoices in the correct formats
        if (q.distractors && !q.distractorChoices) {
          // Convert object-based format to array format for the player
          normalizedQuestion.distractorChoices = [
            { level: 1, distractorText: q.distractors.L1 },
            { level: 2, distractorText: q.distractors.L2 },
            { level: 3, distractorText: q.distractors.L3 }
          ].filter(d => d.distractorText); // Only include entries with actual values
          
          // Add optional higher levels if present
          if (q.distractors.L4) {
            normalizedQuestion.distractorChoices.push({ level: 4, distractorText: q.distractors.L4 });
          }
          if (q.distractors.L5) {
            normalizedQuestion.distractorChoices.push({ level: 5, distractorText: q.distractors.L5 });
          }
        } else if (q.distractorChoices && !q.distractors) {
          // Convert array-based format to object format
          normalizedQuestion.distractors = {};
          q.distractorChoices.forEach(choice => {
            if (choice && typeof choice.level === 'number' && choice.distractorText) {
              normalizedQuestion.distractors[`L${choice.level}`] = choice.distractorText;
            }
          });
        }
        
        // Log serious errors but don't add fallbacks
        if (!normalizedQuestion.correctAnswer) {
          console.error('CRITICAL: Question missing correctAnswer:', normalizedQuestion);
        }
        
        return normalizedQuestion;
      });
      
      // Update the stitch with properly formatted questions
      const updatedStitch = {
        ...stitch,
        questions
      };
      
      // Log detailed diagnostic info about the question format
      if (questions.length > 0) {
        const sampleQuestion = questions[0];
        
        // Deep inspection of the raw question object
        console.log('QUESTION STRUCTURE DIAGNOSIS:');
        console.log('- Original keys:', Object.keys(stitch.questions[0]));
        console.log('- Normalized keys:', Object.keys(sampleQuestion));
        
        // Check specific fields critical for the player
        console.log('CRITICAL FIELDS CHECK:');
        console.log('- correctAnswer present:', 'correctAnswer' in sampleQuestion);
        console.log('- correctAnswer value:', sampleQuestion.correctAnswer);
        console.log('- answer present:', 'answer' in sampleQuestion);
        console.log('- answer value:', sampleQuestion.answer);
        
        // Detailed info about distractors
        console.log('DISTRACTOR FORMAT:');
        if (sampleQuestion.distractors) {
          console.log('- distractors object keys:', Object.keys(sampleQuestion.distractors));
          console.log('- L1 value:', sampleQuestion.distractors.L1);
        }
        if (sampleQuestion.distractorChoices) {
          console.log('- distractorChoices count:', sampleQuestion.distractorChoices.length);
          if (sampleQuestion.distractorChoices.length > 0) {
            console.log('- distractorChoice sample:', sampleQuestion.distractorChoices[0]);
          }
        }
      }
      
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
      
      console.log('Recording session for stitch:', stitchId, 'in tube:', tubeId);
      console.log('Session results:', {
        resultCount: results.results ? results.results.length : 0,
        sessionDuration: results.sessionDuration || 0,
        sampleResult: results.results && results.results.length > 0 ? results.results[0] : null
      });
      
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
import React, { useEffect, useState } from 'react';
import { 
  initializeTubeCycler, 
  createStitchCompletionHandler,
  monitorContentBuffer,
  endSession
} from '../lib/tube-config-integration';
import { saveToLocalStorage } from '../lib/tube-config-loader';
import SessionSummary from './SessionSummary';

/**
 * PlayerComponent - Example component that uses the offline-first tube configuration system
 * 
 * This component demonstrates:
 * 1. Initializing the tube configuration for different user types
 * 2. Using localStorage for all state during gameplay
 * 3. Saving to database only when explicitly ending the session
 * 4. Handling stitch completions with the Triple-Helix pattern
 * 5. Maintaining a 10-stitch buffer for each tube
 */
export default function PlayerComponent({ user }) {
  const [tubeCycler, setTubeCycler] = useState(null);
  const [currentStitch, setCurrentStitch] = useState(null);
  const [tubeStitches, setTubeStitches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTube, setCurrentTube] = useState(1);
  
  // Initialize on component mount
  useEffect(() => {
    async function initialize() {
      try {
        console.log('Initializing TubeCycler...');
        
        // Initialize the TubeCycler with our user
        const adapter = await initializeTubeCycler(user, {
          onStateChange: handleStateChange,
          onTubeChange: handleTubeChange,
          debug: process.env.NODE_ENV !== 'production'
        });
        
        console.log('TubeCycler initialized successfully');
        
        setTubeCycler(adapter);
        setCurrentStitch(adapter.getCurrentStitch());
        setTubeStitches(adapter.getCurrentTubeStitches());
        setCurrentTube(adapter.getCurrentTube());
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing player:', error);
        setIsLoading(false);
      }
    }
    
    initialize();
    
    // Clean up on unmount
    return () => {
      if (tubeCycler) {
        tubeCycler.destroy();
      }
    };
  }, [user]);
  
  // State change handler
  const handleStateChange = (state) => {
    if (!tubeCycler) return;
    
    setCurrentStitch(tubeCycler.getCurrentStitch());
    setTubeStitches(tubeCycler.getCurrentTubeStitches());
  };
  
  // Tube change handler
  const handleTubeChange = (tubeNumber) => {
    setCurrentTube(tubeNumber);
    console.log(`Tube changed to ${tubeNumber}`);
  };
  
  // Update UI after stitch completion
  const updateUIAfterCompletion = (adapter) => {
    setCurrentStitch(adapter.getCurrentStitch());
    setTubeStitches(adapter.getCurrentTubeStitches());
    setCurrentTube(adapter.getCurrentTube());
  };
  
  // Create stitch completion handler
  const handleStitchCompletion = createStitchCompletionHandler(tubeCycler, updateUIAfterCompletion);
  
  // Handle a perfect score (20/20)
  const handlePerfectScore = () => {
    if (!tubeCycler || !currentStitch) return;
    
    handleStitchCompletion(
      currentStitch.threadId,
      currentStitch.id,
      20, // Perfect score
      20  // Total questions
    );
  };
  
  // Handle a partial score (15/20)
  const handlePartialScore = () => {
    if (!tubeCycler || !currentStitch) return;
    
    handleStitchCompletion(
      currentStitch.threadId,
      currentStitch.id,
      15, // Partial score
      20  // Total questions
    );
  };
  
  // Import SessionSummaryData type to avoid circular dependency
  type SessionSummaryData = {
    sessionId: string;
    basePoints: number;
    multiplier: number;
    multiplierType: string;
    totalPoints: number;
    blinkSpeed: number | null;
    correctAnswers: number;
    totalQuestions: number;
    firstTimeCorrect: number;
  };

  // State for session summary
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [sessionSummaryData, setSessionSummaryData] = useState<SessionSummaryData | null>(null);
  
  // Handle End Session button click
  const handleEndSession = async () => {
    if (!tubeCycler) return;
    
    setIsSaving(true);
    
    try {
      // For authenticated users: save to database and get session summary
      if (user) {
        const result = await endSession(user, tubeCycler);
        
        // Import getSessionSummary dynamically to avoid hydration issues
        const { getSessionSummary, getAnonymousSessionStats } = await import('../lib/getSessionSummary');
        
        // Generate session summary data
        const summaryData = getSessionSummary(
          true, // isAuthenticated
          result, // API result with summary
          50 // default points
        );
        
        // Set session summary data and show the summary
        setSessionSummaryData(summaryData);
        setShowSessionSummary(true);
      } 
      // For anonymous users: save to localStorage and generate local summary
      else {
        // Save to localStorage only
        saveToLocalStorage(null, tubeCycler.getState());
        
        // Import getSessionSummary dynamically to avoid hydration issues
        const { getSessionSummary, getAnonymousSessionStats } = await import('../lib/getSessionSummary');
        
        // Get estimated points from local storage
        const stats = getAnonymousSessionStats();
        
        // Generate session summary data
        const summaryData = getSessionSummary(
          false, // isAuthenticated
          null, // no API result for anonymous
          stats.points || 50 // points from local stats or default
        );
        
        // Set session summary data and show the summary
        setSessionSummaryData(summaryData);
        setShowSessionSummary(true);
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Error saving progress. Your progress is still saved in your browser.');
      setIsSaving(false);
    }
  };
  
  // Handle completion of session summary display
  const handleSummaryComplete = () => {
    setShowSessionSummary(false);
    setIsSaving(false);
  };
  
  // Force buffer check (normally this happens automatically)
  const checkContentBuffer = () => {
    if (!tubeCycler) return;
    
    monitorContentBuffer(tubeCycler);
  };
  
  // Render component
  return (
    <div className="player-container">
      <h1>Zenjin Maths</h1>
      
      {/* Session Summary Modal */}
      {showSessionSummary && sessionSummaryData && (
        <div className="session-summary-overlay">
          <SessionSummary 
            sessionData={sessionSummaryData}
            onComplete={handleSummaryComplete}
            className="session-summary-modal"
            isAuthenticated={!!user} // Convert user to boolean
          />
        </div>
      )}
      
      {/* Loading state */}
      {isLoading ? (
        <div className="loading">
          <p>Loading your content...</p>
        </div>
      ) : (
        <div className="player-content">
          
          {/* Show anonymous user reminder */}
          {!user && (
            <div className="anonymous-reminder">
              <p>Create an account to save your progress</p>
            </div>
          )}
          
          {/* Current stitch content */}
          {currentStitch ? (
            <div className="stitch-container">
              <h3>Stitch: {currentStitch.id}</h3>
              <div className="stitch-content">
                {currentStitch.content}
              </div>
              
              {/* Questions would be rendered here */}
              <div className="questions-container">
                {currentStitch.questions?.map((question, index) => (
                  <div key={question.id || index} className="question">
                    <p>{question.text}</p>
                  </div>
                ))}
              </div>
              
              {/* Simulation buttons */}
              <div className="action-buttons">
                <button onClick={handlePerfectScore} className="btn btn-success">
                  Perfect Score (20/20)
                </button>
                <button onClick={handlePartialScore} className="btn btn-warning">
                  Partial Score (15/20)
                </button>
                <button onClick={checkContentBuffer} className="btn btn-info">
                  Check Content Buffer
                </button>
              </div>
            </div>
          ) : (
            <div className="no-content">
              <p>No content available. Please try refreshing the page.</p>
            </div>
          )}
          
          {/* End session button */}
          <div className="end-session">
            <button 
              onClick={handleEndSession}
              disabled={isSaving}
              className="btn btn-primary"
            >
              {isSaving ? 'Saving Progress...' : 'End Session & Finish'}
            </button>
            {!user && (
              <p className="help-text">
                Your progress is saved in your browser.
                Create an account to save progress permanently.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
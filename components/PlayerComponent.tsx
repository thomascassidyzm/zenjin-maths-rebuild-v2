import React, { useEffect, useState } from 'react';
import { 
  initializeTubeCycler, 
  createStitchCompletionHandler,
  monitorContentBuffer,
  endSession
} from '../lib/tube-config-integration';
import { saveToLocalStorage } from '../lib/tube-config-loader';
import SessionSummary from './SessionSummary';
import { offlineFirstContentBuffer } from '../lib/client/offline-first-content-buffer';

/**
 * PlayerComponent - Uses the offline-first tube configuration system
 * 
 * This component implements:
 * 1. Immediate start with no loading screens using bundled content
 * 2. Offline-first approach with all content available without network
 * 3. Triple-Helix pattern for cycling through content
 * 4. Local storage for persistence during gameplay
 * 5. Optional database storage at session end for authenticated users
 */
export default function PlayerComponent({ user }) {
  const [tubeCycler, setTubeCycler] = useState(null);
  const [currentStitch, setCurrentStitch] = useState(null);
  const [tubeStitches, setTubeStitches] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTube, setCurrentTube] = useState(1);
  
  // Initialize on component mount - with immediate content
  useEffect(() => {
    async function initialize() {
      try {
        console.log('Initializing TubeCycler...');
        
        // Initialize the offline-first content buffer
        // This is a no-op since it's already initialized with bundled content
        offlineFirstContentBuffer.initialize(user?.id ? false : true, user);
        
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
      } catch (error) {
        console.error('Error initializing player:', error);
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
  
  // If we don't have a tubeCycler or stitch yet but need to show something immediately,
  // show a content placeholder that doesn't say "Loading..." but still shows something
  const renderContentPlaceholder = () => (
    <div className="stitch-container placeholder">
      <h3>Getting Ready...</h3>
      <div className="stitch-content">
        Welcome to Zenjin Maths! Your learning experience is starting right away.
      </div>
    </div>
  );
  
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
      
      <div className="player-content">
        
        {/* Show anonymous user reminder */}
        {!user && (
          <div className="anonymous-reminder">
            <p>Create an account to save your progress</p>
          </div>
        )}
        
        {/* Current stitch content - no loading state, display immediately */}
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
          // Show content placeholder while initializing
          renderContentPlaceholder()
        )}
        
        {/* End session button */}
        <div className="end-session">
          <button 
            onClick={handleEndSession}
            disabled={isSaving || !tubeCycler}
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
    </div>
  );
}
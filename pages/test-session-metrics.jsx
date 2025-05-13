/**
 * Test Session Metrics Page
 * 
 * Simple test page to verify the session metrics recording through Zustand
 * and test the bubble animations for visual consistency.
 */

import React, { useState, useEffect } from 'react';
import { useZenjinStore } from '../lib/store';
import SessionMetricsProvider from '../lib/components/SessionMetricsProvider';
import styles from '../styles/test-session-metrics.module.css';

// Mock player component for testing
const MockPlayerComponent = (props) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [results, setResults] = useState([]);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);
  
  // Generate mock questions
  const mockQuestions = Array.from({ length: 5 }).map((_, i) => ({
    id: `question-${i + 1}`,
    text: `What is ${i + 1} + ${i + 2}?`,
    correctAnswer: `${i + 1 + i + 2}`,
    distractors: {
      L1: `${i + i + 1}`,
      L2: `${i + i + 4}`,
      L3: `${i + 10}`
    }
  }));
  
  // Handle answering a question
  const handleAnswer = (isCorrect) => {
    // Record result
    const newResult = {
      id: mockQuestions[currentQuestion].id,
      correct: isCorrect,
      timeToAnswer: 1500, // Mock time
      firstTimeCorrect: isCorrect
    };
    
    setResults([...results, newResult]);
    
    // Move to next question or complete session
    if (currentQuestion < mockQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleCompleteSession();
    }
  };
  
  // Complete the session
  const handleCompleteSession = async () => {
    setSessionCompleted(true);
    
    // Prepare session results
    const sessionResults = {
      results: results,
      sessionDuration: 60 // Mock duration in seconds
    };
    
    // Record session if function is available
    if (props.recordSession) {
      try {
        const response = await props.recordSession(sessionResults);
        setSessionSummary(response);
      } catch (error) {
        console.error('Failed to record session:', error);
      }
    }
  };
  
  // Restart the session for testing
  const handleRestart = () => {
    setCurrentQuestion(0);
    setResults([]);
    setSessionCompleted(false);
    setSessionSummary(null);
  };
  
  // Generate bubbles for animation
  const bubbles = Array.from({ length: 20 }).map((_, i) => (
    <div 
      key={i} 
      className={styles.bubble}
      style={{
        width: `${20 + Math.random() * 40}px`,
        height: `${20 + Math.random() * 40}px`,
        left: `${Math.random() * 100}%`,
        animationDuration: `${3 + Math.random() * 8}s`,
        animationDelay: `${Math.random() * 5}s`,
      }}
    />
  ));
  
  return (
    <div className={styles.playerContainer}>
      {/* Persistent bubble animation */}
      <div className={styles.bubblesContainer}>
        {bubbles}
      </div>
      
      {/* Session completed view */}
      {sessionCompleted ? (
        <div className={styles.summaryContainer}>
          <h2>Session Completed</h2>
          
          {props.isRecordingSession && (
            <div className={styles.loadingIndicator}>Recording session...</div>
          )}
          
          {props.sessionError && (
            <div className={styles.errorMessage}>Error: {props.sessionError}</div>
          )}
          
          {sessionSummary && (
            <div className={styles.sessionSummary}>
              <h3>Session Summary</h3>
              <p>Questions Answered: {sessionSummary.totalQuestions}</p>
              <p>Correct Answers: {sessionSummary.correctAnswers}</p>
              <p>First Time Correct: {sessionSummary.firstTimeCorrect} × 3 = {sessionSummary.firstTimeCorrect * 3} pts</p>
              <p>Eventually Correct: {sessionSummary.correctAnswers - sessionSummary.firstTimeCorrect} × 1 = {sessionSummary.correctAnswers - sessionSummary.firstTimeCorrect} pts</p>
              <p>Base Points: {sessionSummary.basePoints}</p>
              <p>Total Points: {sessionSummary.totalPoints}</p>
            </div>
          )}
          
          <button className={styles.button} onClick={handleRestart}>
            Play Again
          </button>
        </div>
      ) : (
        /* Question view */
        <div className={styles.questionContainer}>
          <h2>Question {currentQuestion + 1}</h2>
          <p className={styles.questionText}>{mockQuestions[currentQuestion].text}</p>
          
          <div className={styles.answerButtons}>
            <button 
              className={`${styles.button} ${styles.correctButton}`}
              onClick={() => handleAnswer(true)}
            >
              {mockQuestions[currentQuestion].correctAnswer} (Correct)
            </button>
            
            <button 
              className={`${styles.button} ${styles.incorrectButton}`}
              onClick={() => handleAnswer(false)}
            >
              {mockQuestions[currentQuestion].distractors.L1} (Wrong)
            </button>
          </div>
          
          <div className={styles.progress}>
            {results.map((result, index) => (
              <div 
                key={index} 
                className={`${styles.progressDot} ${result.correct ? styles.correctDot : styles.incorrectDot}`}
              />
            ))}
            {Array.from({ length: mockQuestions.length - results.length }).map((_, index) => (
              <div key={results.length + index} className={styles.progressDot} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Main test page
const TestSessionMetricsPage = () => {
  const { resetStore, initializeState } = useZenjinStore();
  
  // Initialize store with test data
  useEffect(() => {
    // Reset store to clean state
    resetStore();
    
    // Set some test data
    initializeState({
      userInformation: {
        userId: 'test-user-id',
        isAnonymous: false,
        displayName: 'Test User',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      },
      isInitialized: true
    });
  }, [resetStore, initializeState]);
  
  return (
    <div className={styles.testPage}>
      <h1>Test Session Metrics</h1>
      
      <div className={styles.description}>
        <p>This page tests:</p>
        <ol>
          <li>Session metrics recording through Zustand store</li>
          <li>Fix for "Missing thread ID" error using tube-stitch model</li>
          <li>Bubble animations for visual consistency</li>
          <li>Teal color scheme (instead of blue)</li>
        </ol>
      </div>
      
      <div className={styles.playerWrapper}>
        <SessionMetricsProvider 
          tubeId={1}
          stitchId="stitch-T1-001-01"
          onSessionRecorded={(result) => {
            console.log('Session recorded:', result);
          }}
        >
          <MockPlayerComponent />
        </SessionMetricsProvider>
      </div>
    </div>
  );
};

export default TestSessionMetricsPage;
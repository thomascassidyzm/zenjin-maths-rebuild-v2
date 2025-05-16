import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import TubeStitchPlayer from '../components/TubeStitchPlayer';
import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';
import ZustandDistinctionPlayer from '../components/ZustandDistinctionPlayer';
import DistinctionPlayer from '../components/DistinctionPlayer';
import PlayerComponent from '../components/PlayerComponent';
import { Question } from '../lib/types/distinction-learning';
// Import mock store for testing
import '../lib/mock/mockZustandStore';

/**
 * Player Comparison Page
 * 
 * Demonstrates all player components with the same example question
 * for direct comparison of appearance, behavior, and performance.
 */

// Sample question for consistent comparison
const sampleQuestions: Question[] = [
  {
    id: 'sample-q1',
    text: '3 + 5',
    correctAnswer: '8',
    distractors: { L1: '7', L2: '9', L3: '6' }
  },
  {
    id: 'sample-q2',
    text: '7 - 2',
    correctAnswer: '5',
    distractors: { L1: '4', L2: '6', L3: '3' }
  },
  {
    id: 'sample-q3',
    text: '4 × 3',
    correctAnswer: '12',
    distractors: { L1: '6', L2: '10', L3: '9' }
  }
];

// Create a sample stitch with the questions
const sampleStitch = {
  id: 'sample-stitch-1',
  position: 1,
  skipNumber: 3,
  distractorLevel: 'L1',
  questions: sampleQuestions,
  content: "Sample stitch content for testing"
};

// Create a sample thread for players that need it
const sampleThread = {
  id: 'sample-thread-1',
  stitches: [sampleStitch]
};

// Create a sample tube with the stitch
const sampleTubeData = {
  1: {
    id: 'sample-tube-1',
    currentStitchId: 'sample-stitch-1',
    positions: {
      '1': {
        stitchId: 'sample-stitch-1',
        skipNumber: 3,
        distractorLevel: 'L1'
      }
    },
    stitches: [sampleStitch]
  }
};

// Prepare a sample Zustand-compatible tube
const sampleZustandStitch = {
  id: 'sample-stitch-1',
  questions: sampleQuestions
};

export default function PlayerComparison() {
  const router = useRouter();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  
  // Handle player selection
  const selectPlayer = (player: string) => {
    setSelectedPlayer(player);
    setCompleted(false);
  };
  
  // Handle completion
  const handleComplete = (results: any) => {
    console.log('Player completed with results:', results);
    setCompleted(true);
  };
  
  // Handle end session
  const handleEndSession = (results: any) => {
    console.log('Session ended with results:', results);
    setCompleted(true);
  };
  
  // Render the selected player
  const renderSelectedPlayer = () => {
    switch (selectedPlayer) {
      case 'tubeStitch':
        return (
          <div className="player-wrapper">
            <TubeStitchPlayer
              tubeNumber={1}
              tubeData={sampleTubeData}
              onComplete={handleComplete}
              onEndSession={handleEndSession}
              questionsPerSession={3}
            />
          </div>
        );
        
      case 'minimal':
        return (
          <div className="player-wrapper">
            <MinimalDistinctionPlayer
              tubeNumber={1}
              tubeData={sampleTubeData}
              onComplete={handleComplete}
              onEndSession={handleEndSession}
              questionsPerSession={3}
            />
          </div>
        );
        
      case 'zustand':
        return (
          <div className="player-wrapper">
            <ZustandDistinctionPlayer
              stitchId="sample-stitch-1"
              tubeNumber={1}
              onComplete={handleComplete}
              onEndSession={handleEndSession}
              questionsPerSession={3}
            />
          </div>
        );
        
      case 'distinction':
        return (
          <div className="player-wrapper">
            <DistinctionPlayer
              thread={sampleThread}
              onComplete={handleComplete}
              onEndSession={handleEndSession}
              questionsPerSession={3}
            />
          </div>
        );
        
      case 'playerComponent':
        return (
          <div className="player-wrapper player-component-wrapper">
            <PlayerComponent user={null} />
          </div>
        );
        
      default:
        return (
          <div className="no-selection">
            <p>Please select a player component to view</p>
          </div>
        );
    }
  };
  
  // Render a grid of all players for side-by-side comparison
  const renderAllPlayers = () => {
    return (
      <div className="players-grid">
        <div className="player-card">
          <h3>TubeStitchPlayer</h3>
          <div className="player-container">
            <TubeStitchPlayer
              tubeNumber={1}
              tubeData={sampleTubeData}
              onComplete={handleComplete}
              onEndSession={handleEndSession}
              questionsPerSession={3}
            />
          </div>
        </div>
        
        <div className="player-card">
          <h3>MinimalDistinctionPlayer</h3>
          <div className="player-container">
            <MinimalDistinctionPlayer
              tubeNumber={1}
              tubeData={sampleTubeData}
              onComplete={handleComplete}
              onEndSession={handleEndSession}
              questionsPerSession={3}
            />
          </div>
        </div>
        
        <div className="player-card">
          <h3>ZustandDistinctionPlayer</h3>
          <div className="player-container">
            <ZustandDistinctionPlayer
              stitchId="sample-stitch-1"
              tubeNumber={1}
              onComplete={handleComplete}
              onEndSession={handleEndSession}
              questionsPerSession={3}
            />
          </div>
        </div>
        
        <div className="player-card">
          <h3>DistinctionPlayer</h3>
          <div className="player-container">
            <DistinctionPlayer
              thread={sampleThread}
              onComplete={handleComplete}
              onEndSession={handleEndSession}
              questionsPerSession={3}
            />
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto my-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Player Component Comparison</h1>
        <p className="text-gray-600 mt-2">
          Compare all player components with the same example question
        </p>
      </div>
      
      <div className="mb-8">
        <div className="flex justify-center space-x-4 mb-4">
          <button 
            onClick={() => selectPlayer('tubeStitch')} 
            className={`px-4 py-2 rounded ${selectedPlayer === 'tubeStitch' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            TubeStitchPlayer
          </button>
          <button 
            onClick={() => selectPlayer('minimal')} 
            className={`px-4 py-2 rounded ${selectedPlayer === 'minimal' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            MinimalDistinctionPlayer
          </button>
          <button 
            onClick={() => selectPlayer('zustand')} 
            className={`px-4 py-2 rounded ${selectedPlayer === 'zustand' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            ZustandDistinctionPlayer
          </button>
          <button 
            onClick={() => selectPlayer('distinction')} 
            className={`px-4 py-2 rounded ${selectedPlayer === 'distinction' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            DistinctionPlayer
          </button>
        </div>
        
        <div className="flex justify-center space-x-4 mb-8">
          <button 
            onClick={() => setSelectedPlayer(null)} 
            className="px-4 py-2 rounded bg-green-600 text-white"
          >
            View All Side-by-Side
          </button>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-indigo-800 to-blue-800 min-h-[600px] rounded-xl shadow-xl p-4 flex justify-center items-center">
        {selectedPlayer ? renderSelectedPlayer() : renderAllPlayers()}
      </div>
      
      {completed && (
        <div className="mt-8 p-4 bg-green-100 border border-green-400 rounded text-center">
          <h2 className="text-xl font-bold text-green-800">Session Completed!</h2>
          <p className="text-green-700">Check the console for the session results</p>
          <button 
            onClick={() => setCompleted(false)} 
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded"
          >
            Reset
          </button>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-bold mb-4">Player Components Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-bold">TubeStitchPlayer</h3>
            <p>Simplified player that works directly with tube-stitch model with no thread abstraction.</p>
            <ul className="list-disc pl-5 mt-2">
              <li>Fixed height container with responsive design</li>
              <li>Direct support for position-based stitch model</li>
              <li>Minimal dependencies</li>
            </ul>
          </div>
          
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-bold">MinimalDistinctionPlayer</h3>
            <p>Streamlined player based on TubeStitchPlayer with additional warm-up mode support.</p>
            <ul className="list-disc pl-5 mt-2">
              <li>Fixed dimensions for consistent mobile layout</li>
              <li>Additional support for warm-up mode</li>
              <li>Low-dependency implementation</li>
            </ul>
          </div>
          
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-bold">ZustandDistinctionPlayer</h3>
            <p>Zustand-powered player with direct integration with the Zustand state system.</p>
            <ul className="list-disc pl-5 mt-2">
              <li>Content fetching using Zustand hooks</li>
              <li>Server-first content approach</li>
              <li>Built-in state persistence</li>
            </ul>
          </div>
          
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-bold">DistinctionPlayer</h3>
            <p>Original player component that works with the full thread-based model.</p>
            <ul className="list-disc pl-5 mt-2">
              <li>Animated bubble background</li>
              <li>Support for the original thread data model</li>
              <li>Flexible orientation handling</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
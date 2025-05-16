import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

// Import all player components
import TubeStitchPlayer from '../components/TubeStitchPlayer';
import MinimalDistinctionPlayer from '../components/MinimalDistinctionPlayer';
import ZustandDistinctionPlayer from '../components/ZustandDistinctionPlayer';
import DistinctionPlayer from '../components/DistinctionPlayer';
import PlayerComponent from '../components/PlayerComponent';
import PlayerComponentZustand from '../components/PlayerComponentZustand';
import PlayerWithLoader from '../components/PlayerWithLoader';
import MinimalDistinctionPlayerWithUpgrade from '../components/MinimalDistinctionPlayerWithUpgrade';
import SequentialPlayer from '../components/SequentialPlayer';
// Import mock store for testing
import '../lib/mock/mockZustandStore';

/**
 * Player Showcase Page
 * 
 * Displays all player components available in the system with sample content
 * for direct comparison of appearance, behavior, and features.
 */

// Sample question for consistent comparison
const sampleQuestions = [
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

export default function PlayerShowcase() {
  const router = useRouter();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(true);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'single' | 'grid'>('grid');
  
  // Handle player selection
  const selectPlayer = (player: string) => {
    setSelectedPlayer(player);
    setCompleted(false);
    setShowAllPlayers(false);
    setViewMode('single');
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

  // Define all player components with their names for easy rendering
  const players = [
    {
      id: 'tubeStitch',
      name: 'TubeStitchPlayer',
      description: 'Simplified player that works directly with tube-stitch model with no thread abstraction.',
      features: [
        'Fixed height container with responsive design',
        'Direct support for position-based stitch model',
        'Minimal dependencies'
      ],
      component: (
        <TubeStitchPlayer
          tubeNumber={1}
          tubeData={sampleTubeData}
          onComplete={handleComplete}
          onEndSession={handleEndSession}
          questionsPerSession={3}
        />
      )
    },
    {
      id: 'minimal',
      name: 'MinimalDistinctionPlayer',
      description: 'Streamlined player based on TubeStitchPlayer with additional warm-up mode support.',
      features: [
        'Fixed dimensions for consistent mobile layout',
        'Additional support for warm-up mode',
        'Low-dependency implementation'
      ],
      component: (
        <MinimalDistinctionPlayer
          tubeNumber={1}
          tubeData={sampleTubeData}
          onComplete={handleComplete}
          onEndSession={handleEndSession}
          questionsPerSession={3}
        />
      )
    },
    {
      id: 'minimalWithUpgrade',
      name: 'MinimalDistinctionPlayerWithUpgrade',
      description: 'Enhanced minimal player with subscription upgrade prompts.',
      features: [
        'Subscription upgrade UI integration',
        'Premium content preview',
        'Conversion optimization'
      ],
      component: (
        <MinimalDistinctionPlayerWithUpgrade
          tubeNumber={1}
          tubeData={sampleTubeData}
          onComplete={handleComplete}
          onEndSession={handleEndSession}
          questionsPerSession={3}
        />
      )
    },
    {
      id: 'zustand',
      name: 'ZustandDistinctionPlayer',
      description: 'Zustand-powered player with direct integration with the Zustand state system.',
      features: [
        'Content fetching using Zustand hooks',
        'Server-first content approach',
        'Built-in state persistence'
      ],
      component: (
        <ZustandDistinctionPlayer
          stitchId="sample-stitch-1"
          tubeNumber={1}
          onComplete={handleComplete}
          onEndSession={handleEndSession}
          questionsPerSession={3}
        />
      )
    },
    {
      id: 'distinction',
      name: 'DistinctionPlayer',
      description: 'Original player component that works with the full thread-based model.',
      features: [
        'Animated bubble background',
        'Support for the original thread data model',
        'Flexible orientation handling'
      ],
      component: (
        <DistinctionPlayer
          thread={sampleThread}
          onComplete={handleComplete}
          onEndSession={handleEndSession}
          questionsPerSession={3}
        />
      )
    },
    {
      id: 'sequential',
      name: 'SequentialPlayer',
      description: 'Sequential player for ordered content presentation.',
      features: [
        'Strictly sequential question flow',
        'Progress tracking',
        'Simplified interface'
      ],
      component: (
        <SequentialPlayer
          tubeNumber={1}
          tubeData={sampleTubeData}
          onComplete={handleComplete}
          onEndSession={handleEndSession}
          questionsPerSession={3}
        />
      )
    },
    {
      id: 'playerComponent',
      name: 'PlayerComponent',
      description: 'Classic player implementation with full subscription awareness.',
      features: [
        'Full authentication integration',
        'Legacy component compatibility',
        'Supports all question types'
      ],
      component: (
        <PlayerComponent user={null} />
      )
    },
    {
      id: 'playerComponentZustand',
      name: 'PlayerComponentZustand',
      description: 'Zustand-powered player component with global state management.',
      features: [
        'Global state management',
        'Optimized rerenders',
        'Persistent state across navigation'
      ],
      component: (
        <PlayerComponentZustand user={null} />
      )
    },
    {
      id: 'playerWithLoader',
      name: 'PlayerWithLoader',
      description: 'Player with integrated loading management and error handling.',
      features: [
        'Loading state management',
        'Error boundary integration',
        'Clean state transitions'
      ],
      component: (
        <PlayerWithLoader
          tubeNumber={1}
          tubeData={sampleTubeData}
          onComplete={handleComplete}
          onEndSession={handleEndSession}
          userId={null}
        />
      )
    }
  ];
  
  // Render the selected player
  const renderSelectedPlayer = () => {
    const player = players.find(p => p.id === selectedPlayer);
    
    if (!player) {
      return (
        <div className="no-selection">
          <p>Please select a player component to view</p>
        </div>
      );
    }
    
    return (
      <div className="player-wrapper">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white">{player.name}</h2>
          <p className="text-gray-300 mt-1">{player.description}</p>
          
          <div className="mt-3">
            <h3 className="text-lg font-semibold text-white mb-2">Key Features:</h3>
            <ul className="list-disc pl-5 text-gray-300">
              {player.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="mt-6 bg-gray-900 bg-opacity-50 p-4 rounded-lg shadow-lg">
          {player.component}
        </div>
      </div>
    );
  };
  
  // Render a grid of all players
  const renderPlayersGrid = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {players.map((player) => (
          <div 
            key={player.id}
            className="bg-gray-800 bg-opacity-50 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
          >
            <div className="p-4 bg-gradient-to-r from-indigo-900 to-blue-900">
              <h3 className="text-xl font-bold text-white">{player.name}</h3>
              <p className="text-gray-300 text-sm mt-1 h-12 overflow-hidden">{player.description}</p>
            </div>
            
            <div className="p-4 flex justify-center">
              <div className="player-container w-full flex justify-center items-center">
                {player.component}
              </div>
            </div>
            
            <div className="px-4 pb-4">
              <button
                onClick={() => selectPlayer(player.id)}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                View Full Size
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Render players side by side for direct comparison
  const renderPlayersSideBySide = () => {
    return (
      <div className="players-side-by-side grid grid-cols-1 md:grid-cols-2 gap-6">
        {players.slice(0, 4).map((player) => (
          <div 
            key={player.id}
            className="player-card bg-gray-800 bg-opacity-40 p-4 rounded-xl shadow-lg"
          >
            <h3 className="text-xl font-bold text-white mb-3">{player.name}</h3>
            <div className="player-container w-full flex justify-center">
              {player.component}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render content based on view mode
  const renderContent = () => {
    if (!showAllPlayers) {
      return renderSelectedPlayer();
    }
    
    switch (viewMode) {
      case 'grid':
        return renderPlayersGrid();
      case 'side-by-side':
        return renderPlayersSideBySide();
      default:
        return renderPlayersGrid();
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-indigo-900 py-10 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">Player Component Showcase</h1>
          <p className="text-gray-300 mt-2">
            Compare all player components with the same example content
          </p>
        </div>
        
        {/* View controls */}
        <div className="mb-8">
          <div className="flex flex-wrap justify-center space-x-2 space-y-2 md:space-y-0 mb-4">
            {showAllPlayers ? (
              <>
                <button 
                  onClick={() => setViewMode('grid')} 
                  className={`px-4 py-2 rounded ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
                >
                  Grid View
                </button>
                <button 
                  onClick={() => setViewMode('side-by-side')} 
                  className={`px-4 py-2 rounded ${viewMode === 'side-by-side' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
                >
                  Side-by-Side (Top 4)
                </button>
              </>
            ) : (
              <button 
                onClick={() => {
                  setShowAllPlayers(true);
                  setSelectedPlayer(null);
                }} 
                className="px-4 py-2 rounded bg-gray-700 text-gray-200"
              >
                ← Back to All Players
              </button>
            )}
          </div>
          
          {showAllPlayers && (
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {players.map((player) => (
                <button 
                  key={player.id}
                  onClick={() => selectPlayer(player.id)} 
                  className={`px-3 py-1 text-sm rounded ${selectedPlayer === player.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
                >
                  {player.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Main content area */}
        <div className="mb-8">
          {renderContent()}
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
        
        {/* Footer */}
        <div className="mt-10 text-center text-gray-400 text-sm">
          <p>
            This showcase demonstrates all player variants. Use this page to compare and select the most appropriate
            player for your implementation.
          </p>
          <div className="mt-4">
            <Link href="/player-comparison" className="text-blue-400 hover:text-blue-300 underline">
              Go to Original Player Comparison
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
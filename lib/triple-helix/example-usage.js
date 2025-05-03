/**
 * Example Usage of PositionBasedStateMachine
 * 
 * This file demonstrates how to integrate the position-based StateMachine
 * into the Zenjin Maths player with minimal changes to existing code.
 */

// Import the new StateMachine
const PositionBasedStateMachine = require('./PositionBasedStateMachine');

/**
 * Creates a Triple-Helix state machine
 * 
 * @param {Object} initialState - Initial state from server or localStorage
 * @param {Object} options - Options for state machine
 * @returns {Object} StateMachine instance
 */
function createTripleHelixStateMachine(initialState, options = {}) {
  // If feature flag is enabled, use the position-based implementation
  if (options.usePositionBasedStateMachine) {
    console.log('Using position-based StateMachine implementation');
    return new PositionBasedStateMachine(initialState);
  }
  
  // Otherwise use the legacy implementation
  console.log('Using legacy StateMachine implementation');
  const StateMachine = require('./StateMachine');
  return new StateMachine(initialState);
}

/**
 * Triple Helix Player Component Integration Example
 */
class TripleHelixPlayer {
  constructor(props) {
    // Initialize state
    this.state = {
      isLoading: true,
      tubeCycler: null,
      currentStitch: null,
      // ... other player state
    };
    
    // Create state machine
    this.initializeStateMachine(props);
  }
  
  async initializeStateMachine(props) {
    try {
      // Fetch initial state from server or localStorage
      const initialState = await this.fetchInitialState(props.userId);
      
      // Create state machine with feature flag from environment or props
      const usePositionBased = props.usePositionBasedStateMachine || 
                              process.env.USE_POSITION_BASED_STATEMACHINE === 'true';
      
      this.tubeCycler = createTripleHelixStateMachine(initialState, {
        usePositionBasedStateMachine: usePositionBased
      });
      
      // Get current stitch
      const currentStitch = this.tubeCycler.getCurrentStitch();
      
      // Update component state
      this.setState({
        isLoading: false,
        tubeCycler: this.tubeCycler,
        currentStitch,
        // ... other state updates
      });
      
      // Pre-fetch content for initial stitch
      if (currentStitch) {
        this.fetchStitchContent(currentStitch.id);
      }
    } catch (error) {
      console.error('Error initializing state machine:', error);
      // Handle initialization error
    }
  }
  
  async fetchInitialState(userId) {
    // First try to load from localStorage (offline-first)
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem(`triple_helix_state_${userId}`);
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          console.log('Found existing state in localStorage');
          return parsedState;
        }
      } catch (err) {
        console.warn('Could not load state from localStorage', err);
      }
    }
    
    // Otherwise fetch from server
    try {
      console.log('Fetching state from server...');
      const response = await fetch(`/api/user-state?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error fetching state');
      }
      
      console.log('State loaded from server successfully');
      return data.state;
    } catch (error) {
      console.error('Error fetching state from server:', error);
      // Return default state if we can't fetch from server
      return {
        userId,
        activeTubeNumber: 1,
        cycleCount: 0,
        // ... other default state properties
      };
    }
  }
  
  async fetchStitchContent(stitchId) {
    // Implementation for fetching stitch content from server or cache
    console.log(`Fetching content for stitch ${stitchId}...`);
    // ... fetch content logic
  }
  
  handleStitchCompletion(threadId, stitchId, score, totalQuestions) {
    // Update state machine
    const nextStitch = this.tubeCycler.handleStitchCompletion(
      threadId, stitchId, score, totalQuestions
    );
    
    // Update component state
    this.setState({
      currentStitch: nextStitch,
      // ... other state updates
    });
    
    // Pre-fetch content for next stitch
    if (nextStitch) {
      this.fetchStitchContent(nextStitch.id);
    }
    
    return nextStitch;
  }
  
  handleSessionComplete() {
    // Cycle to next tube
    const nextStitch = this.tubeCycler.cycleTubes();
    
    // Update component state
    this.setState({
      currentStitch: nextStitch,
      // ... other state updates
    });
    
    // Pre-fetch content for next stitch
    if (nextStitch) {
      this.fetchStitchContent(nextStitch.id);
    }
    
    return nextStitch;
  }
  
  // Placeholder for React-style setState
  setState(newState) {
    this.state = {
      ...this.state,
      ...newState
    };
    console.log('State updated:', this.state);
  }
  
  // Example render method (simplified)
  render() {
    if (this.state.isLoading) {
      return 'Loading...';
    }
    
    if (!this.state.currentStitch) {
      return 'No stitch available';
    }
    
    return `
      Current Tube: ${this.state.tubeCycler.getCurrentTubeNumber()}
      Current Stitch: ${this.state.currentStitch.id}
      Skip Number: ${this.state.currentStitch.skipNumber}
      Distractor Level: ${this.state.currentStitch.distractorLevel}
    `;
  }
}

// Example usage
const exampleUsage = () => {
  console.log('Creating TripleHelixPlayer instance...');
  const player = new TripleHelixPlayer({
    userId: 'test-user-1',
    usePositionBasedStateMachine: true
  });
  
  // Simulate stitch completion after initialization
  setTimeout(() => {
    if (player.state.currentStitch) {
      console.log('\nSimulating stitch completion...');
      player.handleStitchCompletion(
        'thread-T1-001',
        player.state.currentStitch.id,
        20, // Perfect score
        20  // Total questions
      );
      
      // Simulate session completion
      setTimeout(() => {
        console.log('\nSimulating session completion and tube cycling...');
        player.handleSessionComplete();
      }, 1000);
    }
  }, 1000);
};

// Run the example if this file is executed directly
if (require.main === module) {
  exampleUsage();
}

module.exports = {
  createTripleHelixStateMachine,
  TripleHelixPlayer
};
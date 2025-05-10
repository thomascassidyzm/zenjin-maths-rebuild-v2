/**
 * Core Fix for TubeCycler Initialization
 * 
 * This patch addresses the specific initialization issues
 * where tube structures and content manager are not properly initialized.
 * 
 * INSTRUCTIONS:
 * 1. Import this at the top of lib/tube-config-integration.js
 * 2. Call validateAndFixInitialization() before any StateMachine initialization
 */

// Fixes tube structure format issues
export function validateAndFixTubeStructure(config) {
  console.log('Validating and fixing tube structure...');
  
  // Common issue #1: tubes is not an array when expected to be
  if (config && config.tubes && !Array.isArray(config.tubes) && typeof config.tubes === 'object') {
    console.log('Converting tubes object to array format');
    const tubesArray = [];
    
    // Convert object format {1: {...}, 2: {...}, 3: {...}} to array format
    Object.entries(config.tubes).forEach(([tubeNumber, tubeData]) => {
      tubesArray.push({
        number: parseInt(tubeNumber, 10),
        ...tubeData
      });
    });
    
    config.tubes = tubesArray;
  }
  
  // Common issue #2: Missing activeStitches array
  if (config && config.tubes && Array.isArray(config.tubes)) {
    config.tubes.forEach(tube => {
      if (!tube.activeStitches || !Array.isArray(tube.activeStitches)) {
        console.log(`Fixing missing activeStitches array for tube ${tube.number}`);
        tube.activeStitches = [];
      }
    });
  }
  
  return config;
}

// Creates an emergency content manager if one is missing
export function ensureValidContentManager(adapter) {
  if (!adapter) return;
  
  // Check if content manager exists and has required methods
  if (!adapter.contentManager || 
      typeof adapter.contentManager.getContent !== 'function' ||
      typeof adapter.contentManager.addToCache !== 'function') {
    
    console.log('Creating emergency content manager');
    
    // Create minimum viable content manager
    adapter.contentManager = {
      cache: {},
      
      getContent: async (stitchId) => {
        console.log(`Emergency content manager: Getting content for ${stitchId}`);
        
        if (adapter.contentManager.cache[stitchId]) {
          return adapter.contentManager.cache[stitchId];
        }
        
        // Create emergency stitch content
        const stitch = createEmergencyStitch(stitchId);
        adapter.contentManager.cache[stitchId] = stitch;
        return stitch;
      },
      
      addToCache: (stitches) => {
        if (!stitches || !Array.isArray(stitches)) return;
        
        console.log(`Emergency content manager: Adding ${stitches.length} stitches to cache`);
        
        stitches.forEach(stitch => {
          if (stitch && stitch.id) {
            adapter.contentManager.cache[stitch.id] = stitch;
          }
        });
      },
      
      clearCache: () => {
        adapter.contentManager.cache = {};
      }
    };
  }
}

// Creates emergency stitch content
function createEmergencyStitch(stitchId) {
  console.log(`Creating emergency stitch for ${stitchId}`);
  
  // Extract tube, thread, stitch numbers from ID if possible
  const match = (stitchId || '').match(/stitch-T(\d+)-(\d+)-(\d+)/);
  const tubeNumber = match ? match[1] : '1';
  const threadNumber = match ? match[2] : '001';
  const stitchNumber = match ? match[3] : '01';
  
  return {
    id: stitchId,
    threadId: `thread-T${tubeNumber}-${threadNumber}`,
    content: `Emergency content for stitch ${stitchId}`,
    questions: Array(3).fill(0).map((_, i) => ({
      id: `${stitchId}-q${i+1}`,
      text: `Question ${i+1} for emergency stitch`,
      correctAnswer: 'Continue',
      distractors: {
        L1: 'Wait',
        L2: 'Retry',
        L3: 'Skip'
      }
    }))
  };
}

// Main validation function to call before initialization
export function validateAndFixInitialization(config, adapter) {
  // Fix tube structure issues
  if (config) {
    config = validateAndFixTubeStructure(config);
  }
  
  // Ensure valid content manager
  if (adapter) {
    ensureValidContentManager(adapter);
  }
  
  return { config, adapter };
}
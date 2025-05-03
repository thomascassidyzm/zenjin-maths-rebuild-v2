/**
 * Enhanced State Persistence Module
 * 
 * This module provides improved state persistence functionality with better error handling,
 * retry logic, and diagnostics to ensure stitch positions are properly saved.
 */

// Method to save state with better error handling and logging
export async function saveStateWithRetry(
  userId: string,
  state: any,
  maxRetries: number = 3
): Promise<boolean> {
  console.log('🔄 Saving state with enhanced retry logic...');
  
  let lastError = null;
  
  // Try multiple times with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} to save state`);
      
      // First save the complete state to user_state table
      const stateResponse = await fetch('/api/user-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store'
        },
        body: JSON.stringify({
          state: {
            ...state,
            lastUpdated: Date.now()
          }
        })
      });
      
      if (!stateResponse.ok) {
        const errorData = await stateResponse.json();
        throw new Error(`Failed to save state: ${stateResponse.status} ${errorData?.error || stateResponse.statusText}`);
      }
      
      console.log('✅ Successfully saved complete state object');
      
      // Now save all stitch positions to ensure they're properly recorded
      // Extract stitch positions from all tubes
      const stitchPositions: Array<{
        userId: string;
        threadId: string;
        stitchId: string;
        orderNumber: number;
        skipNumber: number;
        distractorLevel: string;
        isCurrentTube: boolean;
      }> = [];
      
      // For each tube, extract the stitch positions
      if (state.tubes) {
        Object.entries(state.tubes).forEach(([tubeNumber, tubeData]: [string, any]) => {
          const isActiveTube = parseInt(tubeNumber) === state.activeTubeNumber;
          
          // Extract stitches from this tube
          if (tubeData && tubeData.stitches && Array.isArray(tubeData.stitches)) {
            tubeData.stitches.forEach((stitch: any) => {
              if (stitch.id && stitch.threadId) {
                stitchPositions.push({
                  userId,
                  threadId: stitch.threadId,
                  stitchId: stitch.id,
                  orderNumber: stitch.position || 0,
                  skipNumber: stitch.skipNumber || 3,
                  distractorLevel: stitch.distractorLevel || 'L1',
                  isCurrentTube: isActiveTube && tubeData.currentStitchId === stitch.id
                });
              }
            });
          }
        });
      }
      
      if (stitchPositions.length > 0) {
        console.log(`📊 Saving ${stitchPositions.length} stitch positions...`);
        
        // Save stitch positions in batches of 20 to avoid timeouts
        const BATCH_SIZE = 20;
        for (let i = 0; i < stitchPositions.length; i += BATCH_SIZE) {
          const batch = stitchPositions.slice(i, i + BATCH_SIZE);
          
          try {
            // Make a robust batch update API call
            const batchResponse = await fetch('/api/update-stitch-positions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store'
              },
              body: JSON.stringify({
                userId,
                stitches: batch
              })
            });
            
            if (!batchResponse.ok) {
              console.warn(`⚠️ Batch ${i/BATCH_SIZE + 1} had issues: ${batchResponse.status}`);
              
              // If batch fails, try one-by-one as a fallback
              for (const position of batch) {
                try {
                  // Use minimal fields to increase chances of success
                  await fetch('/api/update-stitch-position', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Cache-Control': 'no-cache, no-store'
                    },
                    body: JSON.stringify({
                      userId,
                      threadId: position.threadId,
                      stitchId: position.stitchId,
                      orderNumber: position.orderNumber
                    })
                  });
                } catch (individualError) {
                  console.error(`Failed to save position for stitch ${position.stitchId}`, individualError);
                }
              }
            } else {
              console.log(`✅ Successfully saved batch ${i/BATCH_SIZE + 1}/${Math.ceil(stitchPositions.length/BATCH_SIZE)}`);
            }
          } catch (batchError) {
            console.error(`Error saving batch ${i/BATCH_SIZE + 1}:`, batchError);
          }
        }
      }
      
      // Save successful
      return true;
    } catch (error) {
      lastError = error;
      console.error(`❌ Attempt ${attempt} failed:`, error);
      
      // Exponential backoff delay before retry
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All attempts failed
  console.error(`❌ All ${maxRetries} attempts failed to save state. Last error:`, lastError);
  
  // Save to localStorage as a backup
  try {
    localStorage.setItem('zenjin_state_backup', JSON.stringify({
      timestamp: Date.now(),
      state
    }));
    console.log('💾 Saved state backup to localStorage');
  } catch (localStorageError) {
    console.error('Failed to save backup to localStorage:', localStorageError);
  }
  
  return false;
}

// Function to diagnose state persistence issues
export async function diagnoseStatePersistence(userId: string): Promise<any> {
  try {
    console.log('🔍 Running state persistence diagnostics...');
    
    // Check if user_stitch_progress table exists and has expected columns
    const schemaResponse = await fetch('/api/check-table-structure?table=user_stitch_progress');
    const schemaData = await schemaResponse.json();
    
    // Check for user's saved stitch positions
    const positionsResponse = await fetch(`/api/user-stitches?userId=${userId}&prefetch=10`);
    const positionsData = await positionsResponse.json();
    
    // Check for user's complete state
    const stateResponse = await fetch(`/api/user-state?userId=${userId}`);
    const stateData = await stateResponse.json();
    
    return {
      success: true,
      schema: schemaData,
      positions: positionsData,
      state: stateData,
      summary: {
        schemaOk: schemaData?.success || false,
        hasSavedPositions: positionsData?.data?.length > 0,
        hasSavedState: stateData?.data?.state != null,
        missingColumns: schemaData?.missingColumns || []
      }
    };
  } catch (error) {
    console.error('Diagnostics failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Function to correct stitches for a user - use this if state loading fails
export async function correctStitchPositions(userId: string): Promise<boolean> {
  try {
    console.log('🛠️ Correcting stitch positions...');
    
    // Request the server to reset and correct stitch positions
    const response = await fetch('/api/reset-stitch-positions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to correct stitch positions: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Stitch position correction complete:', data);
    
    return data.success;
  } catch (error) {
    console.error('❌ Stitch position correction failed:', error);
    return false;
  }
}
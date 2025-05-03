/**
 * Reset Tube Configuration
 * 
 * This script resets tube configuration and user progress to match actual database content.
 * It will delete any references to non-existent stitches and reorder the remaining ones.
 */
const { createClient } = require('@supabase/supabase-js');

// You'll need to provide these values when running the script
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Optional user ID to reset (if not provided, resets all users)
const userId = process.env.RESET_USER_ID;

async function resetTubeConfiguration() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('⚠️ Environment variables not set. Please set:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔧 Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // 1. Get all existing stitches from the database
    console.log('📊 Fetching valid stitches from database...');
    const { data: validStitches, error: stitchError } = await supabase
      .from('stitches')
      .select('id, thread_id, stitch_id')
      .order('thread_id, order');
      
    if (stitchError) {
      console.error('❌ Error fetching stitches:', stitchError);
      throw stitchError;
    }
    
    if (!validStitches || validStitches.length === 0) {
      console.error('❌ No stitches found in database.');
      process.exit(1);
    }
    
    console.log(`Found ${validStitches.length} valid stitches in the database.`);
    
    // Create a map of valid stitch IDs for fast lookup
    const validStitchIds = new Set();
    const stitchesByThread = {};
    
    validStitches.forEach(stitch => {
      const stitchId = stitch.stitch_id || stitch.id;
      validStitchIds.add(stitchId);
      
      if (!stitchesByThread[stitch.thread_id]) {
        stitchesByThread[stitch.thread_id] = [];
      }
      
      stitchesByThread[stitch.thread_id].push({
        id: stitchId,
        thread_id: stitch.thread_id
      });
    });
    
    // 2. Get user progress records
    console.log('🔍 Fetching user progress records...');
    
    let progressQuery = supabase
      .from('user_stitch_progress')
      .select('*');
      
    if (userId) {
      console.log(`Filtering for user ID: ${userId}`);
      progressQuery = progressQuery.eq('user_id', userId);
    }
    
    const { data: progressRecords, error: progressError } = await progressQuery;
    
    if (progressError) {
      console.error('❌ Error fetching user progress:', progressError);
      throw progressError;
    }
    
    if (!progressRecords || progressRecords.length === 0) {
      console.log('ℹ️ No user progress records found.');
      process.exit(0);
    }
    
    console.log(`Found ${progressRecords.length} progress records across all users.`);
    
    // 3. Identify invalid stitch references
    const invalidRecords = progressRecords.filter(record => 
      !validStitchIds.has(record.stitch_id)
    );
    
    console.log(`Found ${invalidRecords.length} invalid stitch references that will be deleted.`);
    
    // 4. Delete invalid records
    if (invalidRecords.length > 0) {
      console.log('🗑️ Deleting invalid progress records...');
      
      // Delete in batches of 100
      for (let i = 0; i < invalidRecords.length; i += 100) {
        const batch = invalidRecords.slice(i, i + 100);
        const deletePromises = batch.map(record => 
          supabase
            .from('user_stitch_progress')
            .delete()
            .eq('user_id', record.user_id)
            .eq('thread_id', record.thread_id)
            .eq('stitch_id', record.stitch_id)
        );
        
        await Promise.all(deletePromises);
        console.log(`Deleted batch ${Math.floor(i/100) + 1} of invalid records.`);
      }
    }
    
    // 5. Get user tube positions
    console.log('🧭 Fetching tube positions...');
    
    let tubeQuery = supabase
      .from('user_tube_position')
      .select('*');
      
    if (userId) {
      tubeQuery = tubeQuery.eq('user_id', userId);
    }
    
    const { data: tubePositions, error: tubeError } = await tubeQuery;
    
    if (tubeError) {
      console.error('❌ Error fetching tube positions:', tubeError);
      throw tubeError;
    }
    
    if (!tubePositions || tubePositions.length === 0) {
      console.log('ℹ️ No tube position records found.');
    } else {
      console.log(`Found ${tubePositions.length} tube position records.`);
    }
    
    // 6. Reset progress for each user
    const userIds = new Set(progressRecords.map(record => record.user_id));
    console.log(`Found ${userIds.size} users to process.`);
    
    for (const currentUserId of userIds) {
      console.log(`\n👤 Processing user ${currentUserId}...`);
      
      // Get all threads for this user
      const userThreads = new Set(
        progressRecords
          .filter(record => record.user_id === currentUserId)
          .map(record => record.thread_id)
      );
      
      console.log(`User has progress in ${userThreads.size} threads.`);
      
      // Process each thread
      for (const threadId of userThreads) {
        const validThreadStitches = stitchesByThread[threadId] || [];
        
        if (validThreadStitches.length === 0) {
          console.log(`⚠️ Thread ${threadId} has no valid stitches in database. Skipping.`);
          continue;
        }
        
        console.log(`Thread ${threadId}: Creating ${validThreadStitches.length} correctly ordered records.`);
        
        // Sort stitches by their numeric ID to ensure proper order (01, 02, 03, etc.)
        const properlyOrderedStitches = [...validThreadStitches].sort((a, b) => {
          // Extract numeric part from stitch ID (e.g., "stitch-A-01" -> "01")
          // Also supports new naming convention: "stitch-T1-001-01" -> "01"
          const aMatch = a.id.match(/-(\d+)$/);
          const bMatch = b.id.match(/-(\d+)$/);
          
          if (aMatch && bMatch) {
            const aNum = parseInt(aMatch[1], 10);
            const bNum = parseInt(bMatch[1], 10);
            return aNum - bNum; // Sort numerically
          }
          
          // Fallback to string comparison if pattern doesn't match
          return a.id.localeCompare(b.id);
        });
        
        console.log(`Thread ${threadId}: Ordered stitches:`, properlyOrderedStitches.map(s => s.id).join(', '));
        
        // Create new progress records with correct ordering
        const newProgressRecords = properlyOrderedStitches.map((stitch, index) => ({
          user_id: currentUserId,
          thread_id: threadId,
          stitch_id: stitch.id,
          order_number: index, // Start with 0 for first stitch (01)
          skip_number: 3,
          distractor_level: 'L1'
        }));
        
        // Delete all existing progress for this user/thread
        console.log(`Deleting existing progress for user ${currentUserId} and thread ${threadId}...`);
        const { error: deleteError } = await supabase
          .from('user_stitch_progress')
          .delete()
          .eq('user_id', currentUserId)
          .eq('thread_id', threadId);
          
        if (deleteError) {
          console.error(`❌ Error deleting progress for user ${currentUserId}, thread ${threadId}:`, deleteError);
          continue;
        }
        
        // Insert new progress records
        console.log(`Creating ${newProgressRecords.length} new progress records...`);
        const { error: insertError } = await supabase
          .from('user_stitch_progress')
          .upsert(newProgressRecords);
          
        if (insertError) {
          console.error(`❌ Error inserting progress for user ${currentUserId}, thread ${threadId}:`, insertError);
          continue;
        }
      }
      
      // Reset tube positions if needed
      const userTubePositions = tubePositions.filter(pos => pos.user_id === currentUserId);
      for (const tubePosition of userTubePositions) {
        // Check if thread exists
        if (!stitchesByThread[tubePosition.thread_id] || stitchesByThread[tubePosition.thread_id].length === 0) {
          console.log(`⚠️ Tube position for user ${currentUserId} references non-existent thread ${tubePosition.thread_id}.`);
          
          // Find a valid thread for this tube
          const validThreads = Object.keys(stitchesByThread).filter(id => {
            const firstStitch = stitchesByThread[id][0];
            // Check if thread has same first letter as tube number
            const letterMatch = id.includes(`thread-${String.fromCharCode(64 + tubePosition.tube_number)}`);
            return letterMatch && stitchesByThread[id].length > 0;
          });
          
          if (validThreads.length > 0) {
            console.log(`Updating tube position to use valid thread ${validThreads[0]}.`);
            
            const { error: updateError } = await supabase
              .from('user_tube_position')
              .update({ thread_id: validThreads[0] })
              .eq('user_id', currentUserId)
              .eq('tube_number', tubePosition.tube_number);
              
            if (updateError) {
              console.error(`❌ Error updating tube position for user ${currentUserId}:`, updateError);
            }
          }
        }
      }
    }
    
    console.log('\n✅ Tube configuration reset completed successfully!');
    console.log('All users now have consistent tube configurations with valid stitches.');
    
  } catch (error) {
    console.error('❌ Error in reset process:', error);
    process.exit(1);
  }
}

// Execute the script
resetTubeConfiguration();
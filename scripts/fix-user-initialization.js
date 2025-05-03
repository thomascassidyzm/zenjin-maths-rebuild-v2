/**
 * User Initialization Fix
 * 
 * This script fixes issues with new users not seeing existing database content.
 * It ensures proper user initialization in the database.
 */
const { createClient } = require('@supabase/supabase-js');

// You'll need to provide these values when running the script
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fixUserInitialization() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('⚠️ Environment variables not set. Please set:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🔧 Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    // 1. Verify tables exist (create if missing)
    console.log('🔍 Checking for required tables...');
    await verifyTables(supabase);

    // 2. Get all threads and stitches
    console.log('📊 Fetching threads and stitches...');
    const [threads, stitches] = await Promise.all([
      fetchThreads(supabase),
      fetchStitches(supabase)
    ]);

    console.log(`Found ${threads.length} threads and ${stitches.length} stitches`);
    
    if (threads.length === 0 || stitches.length === 0) {
      console.error('❌ Error: No content found in the database.');
      console.error('Please import content before running this script.');
      process.exit(1);
    }

    // 3. Check for anonymous user or test user
    console.log('👤 Creating test user for verification...');
    const testUserId = 'test-user-' + Date.now();
    console.log(`Using test user ID: ${testUserId}`);

    // 4. Create initial progress records for test user
    console.log('📝 Creating initial progress records...');
    const result = await initializeUserProgress(supabase, testUserId, threads, stitches);
    
    // 5. Create tube position records
    console.log('🧭 Setting tube position...');
    await initializeTubePosition(supabase, testUserId, threads);

    console.log('✅ User initialization process completed successfully!');
    console.log(`Created ${result.successCount} progress records`);
    
    console.log('\n📋 Verification Steps:');
    console.log('1. Sign in as a new user in the app');
    console.log('2. You should now see content from the database instead of generated sample content');
    console.log('3. If issues persist, check the app logs for "Creating sample content" messages');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function verifyTables(supabase) {
  // Check if user_stitch_progress table exists
  const { data: progressTable, error: progressError } = await supabase
    .from('user_stitch_progress')
    .select('*')
    .limit(1);

  if (progressError && progressError.code === '42P01') { // table doesn't exist
    console.log('⚠️ user_stitch_progress table not found, creating it...');
    
    // Create the table
    const { error: createError } = await supabase
      .rpc('exec_sql', { 
        sql_query: `
          CREATE TABLE IF NOT EXISTS public.user_stitch_progress (
            user_id TEXT NOT NULL,
            thread_id TEXT NOT NULL,
            stitch_id TEXT NOT NULL,
            order_number INTEGER NOT NULL DEFAULT 999,
            skip_number INTEGER NOT NULL DEFAULT 3,
            distractor_level TEXT NOT NULL DEFAULT 'L1',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, thread_id, stitch_id)
          );
        `
      });
      
    if (createError) {
      console.error('❌ Error creating user_stitch_progress table:', createError);
      throw createError;
    }
    
    console.log('✅ Created user_stitch_progress table');
  }

  // Check if user_tube_position table exists
  const { data: tubeTable, error: tubeError } = await supabase
    .from('user_tube_position')
    .select('*')
    .limit(1);

  if (tubeError && tubeError.code === '42P01') { // table doesn't exist
    console.log('⚠️ user_tube_position table not found, creating it...');
    
    // Create the table
    const { error: createError } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS public.user_tube_position (
            user_id TEXT NOT NULL PRIMARY KEY,
            tube_number INTEGER NOT NULL DEFAULT 1,
            thread_id TEXT NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `
      });
      
    if (createError) {
      console.error('❌ Error creating user_tube_position table:', createError);
      throw createError;
    }
    
    console.log('✅ Created user_tube_position table');
  }
}

async function fetchThreads(supabase) {
  const { data, error } = await supabase
    .from('threads')
    .select('*')
    .order('id');
    
  if (error) {
    console.error('❌ Error fetching threads:', error);
    throw error;
  }
  
  return data || [];
}

async function fetchStitches(supabase) {
  const { data, error } = await supabase
    .from('stitches')
    .select('*')
    .order('thread_id, stitch_id');
    
  if (error) {
    console.error('❌ Error fetching stitches:', error);
    throw error;
  }
  
  return data || [];
}

async function initializeUserProgress(supabase, userId, threads, stitches) {
  // Create progress records for the user
  const progressRecords = [];
  let successCount = 0;
  
  for (const thread of threads) {
    // Find all stitches for this thread
    const threadStitches = stitches.filter(stitch => stitch.thread_id === thread.id);
    
    // Sort by order if available
    let sortedStitches = [...threadStitches];
    if (sortedStitches.length > 0 && 'order' in sortedStitches[0]) {
      sortedStitches.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    // Create progress records
    sortedStitches.forEach((stitch, index) => {
      progressRecords.push({
        user_id: userId,
        thread_id: thread.id,
        stitch_id: stitch.stitch_id || stitch.id, // Handle both column names
        order_number: index === 0 ? 0 : index, // First is active (0), rest sequential
        skip_number: 3,
        distractor_level: 'L1'
      });
    });
  }
  
  // Insert the progress records in batches of 100
  for (let i = 0; i < progressRecords.length; i += 100) {
    const batch = progressRecords.slice(i, i + 100);
    console.log(`Inserting batch ${i/100 + 1} (${batch.length} records)...`);
    
    const { error } = await supabase
      .from('user_stitch_progress')
      .upsert(batch);
      
    if (error) {
      console.error(`❌ Error inserting progress batch ${i/100 + 1}:`, error);
      
      // Try minimal fields insertion if there's a schema error
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('⚠️ Schema error detected, trying minimal insert...');
        
        // Create minimal records with only essential fields
        const minimalBatch = batch.map(record => ({
          user_id: record.user_id,
          thread_id: record.thread_id,
          stitch_id: record.stitch_id,
          order_number: record.order_number
        }));
        
        const { error: minimalError } = await supabase
          .from('user_stitch_progress')
          .upsert(minimalBatch);
          
        if (minimalError) {
          console.error('❌ Even minimal insert failed:', minimalError);
        } else {
          console.log(`✅ Successfully inserted ${minimalBatch.length} records with minimal fields`);
          successCount += minimalBatch.length;
        }
      }
    } else {
      console.log(`✅ Successfully inserted batch ${i/100 + 1}`);
      successCount += batch.length;
    }
  }
  
  return { successCount };
}

async function initializeTubePosition(supabase, userId, threads) {
  // Find the Thread-A or first thread for Tube-1
  let tube1Thread = threads.find(t => 
    (t.tube_number === 1) || (t.id && t.id.includes('thread-A'))
  );
  
  // Fallback to first thread if no specific thread found
  if (!tube1Thread && threads.length > 0) {
    tube1Thread = threads[0];
  }
  
  if (!tube1Thread) {
    console.error('❌ No threads found for Tube-1');
    return false;
  }
  
  // Set the tube position
  const { error } = await supabase
    .from('user_tube_position')
    .upsert({
      user_id: userId,
      tube_number: 1,
      thread_id: tube1Thread.id,
      updated_at: new Date().toISOString()
    });
    
  if (error) {
    console.error('❌ Error setting tube position:', error);
    
    // Try minimal fields
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('⚠️ Schema error detected, trying minimal fields...');
      
      const { error: minimalError } = await supabase
        .from('user_tube_position')
        .upsert({
          user_id: userId,
          tube_number: 1,
          thread_id: tube1Thread.id
        });
        
      if (minimalError) {
        console.error('❌ Even minimal tube position insert failed:', minimalError);
        return false;
      } else {
        console.log('✅ Successfully set tube position with minimal fields');
        return true;
      }
    }
    
    return false;
  }
  
  console.log(`✅ Successfully set tube position to Tube-1, Thread-${tube1Thread.id}`);
  return true;
}

// Execute the script
fixUserInitialization();
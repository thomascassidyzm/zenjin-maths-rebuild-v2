import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/auth/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('API: Creating test data...');
    
    // Step 1: Check if tables exist
    const { error: tablesError } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .limit(1);
    
    if (tablesError) {
      console.log('Error checking tables, assuming they need to be created:', tablesError);
    }
    
    // Step 2: Create tables if they don't exist
    
    // Create threads table
    console.log('Creating threads table...');
    const { error: threadsError } = await supabase.rpc('create_tables_if_not_exist', {
      create_threads: true
    });
    
    if (threadsError) {
      console.error('Error creating threads table:', threadsError);
      return res.status(500).json({ error: 'Failed to create threads table', details: threadsError });
    }
    
    // Create stitches table
    console.log('Creating stitches table...');
    const { error: stitchesError } = await supabase.rpc('create_tables_if_not_exist', {
      create_stitches: true
    });
    
    if (stitchesError) {
      console.error('Error creating stitches table:', stitchesError);
      return res.status(500).json({ error: 'Failed to create stitches table', details: stitchesError });
    }
    
    // Create questions table
    console.log('Creating questions table...');
    const { error: questionsError } = await supabase.rpc('create_tables_if_not_exist', {
      create_questions: true
    });
    
    if (questionsError) {
      console.error('Error creating questions table:', questionsError);
      return res.status(500).json({ error: 'Failed to create questions table', details: questionsError });
    }
    
    // Create user_threads table
    console.log('Creating user_threads table...');
    const { error: userThreadsError } = await supabase.rpc('create_tables_if_not_exist', {
      create_user_threads: true
    });
    
    if (userThreadsError) {
      console.error('Error creating user_threads table:', userThreadsError);
      return res.status(500).json({ error: 'Failed to create user_threads table', details: userThreadsError });
    }
    
    // Create user_stitch_progress table
    console.log('Creating user_stitch_progress table...');
    const { error: progressError } = await supabase.rpc('create_tables_if_not_exist', {
      create_progress: true
    });
    
    if (progressError) {
      console.error('Error creating user_stitch_progress table:', progressError);
      return res.status(500).json({ error: 'Failed to create user_stitch_progress table', details: progressError });
    }
    
    // Create session_results table
    console.log('Creating session_results table...');
    const { error: resultsError } = await supabase.rpc('create_tables_if_not_exist', {
      create_results: true
    });
    
    if (resultsError) {
      console.error('Error creating session_results table:', resultsError);
      return res.status(500).json({ error: 'Failed to create session_results table', details: resultsError });
    }
    
    // Step 3: Insert test data if tables are empty
    
    // Check if threads table is empty
    const { data: existingThreads, error: checkThreadsError } = await supabase
      .from('threads')
      .select('id')
      .limit(1);
    
    if (checkThreadsError) {
      console.error('Error checking if threads exist:', checkThreadsError);
      return res.status(500).json({ error: 'Failed to check if threads exist', details: checkThreadsError });
    }
    
    // Insert test data if no threads found
    if (!existingThreads || existingThreads.length === 0) {
      console.log('No threads found, inserting test data...');
      
      // Insert test threads using upsert to handle conflicts
      const { data: threadData, error: insertThreadsError } = await supabase
        .from('threads')
        .upsert([
          { id: 'add-thread', name: 'Addition', description: 'Basic addition skills' },
          { id: 'sub-thread', name: 'Subtraction', description: 'Basic subtraction skills' },
          { id: 'mul-thread', name: 'Multiplication', description: 'Basic multiplication skills' }
        ], { onConflict: 'id' })
        .select();
      
      if (insertThreadsError) {
        console.error('Error inserting test threads:', insertThreadsError);
        return res.status(500).json({ error: 'Failed to insert test threads', details: insertThreadsError });
      }
      
      // Insert test stitches for each thread
      for (const thread of ['add-thread', 'sub-thread', 'mul-thread']) {
        // Create 5 test stitches per thread
        const stitches = Array.from({ length: 5 }, (_, i) => ({
          id: `${thread}-stitch-${i+1}`,
          thread_id: thread,
          name: `${thread.split('-')[0].charAt(0).toUpperCase() + thread.split('-')[0].slice(1)} Stitch ${i+1}`,
          description: `Test stitch ${i+1} for ${thread}`,
          order: i
        }));
        
        const { error: insertStitchesError } = await supabase
          .from('stitches')
          .upsert(stitches, { onConflict: 'id' });
        
        if (insertStitchesError) {
          console.error(`Error inserting stitches for thread ${thread}:`, insertStitchesError);
          return res.status(500).json({ 
            error: `Failed to insert stitches for thread ${thread}`, 
            details: insertStitchesError 
          });
        }
        
        // Insert test questions for each stitch
        for (const stitch of stitches) {
          // Create 20 test questions per stitch
          const questions = Array.from({ length: 20 }, (_, i) => {
            let a, b, answer, text;
            
            if (thread === 'add-thread') {
              a = Math.floor(Math.random() * 20) + 1;
              b = Math.floor(Math.random() * 20) + 1;
              answer = a + b;
              text = `${a} + ${b}`;
            } else if (thread === 'sub-thread') {
              a = Math.floor(Math.random() * 20) + 10;
              b = Math.floor(Math.random() * a);
              answer = a - b;
              text = `${a} - ${b}`;
            } else { // mul-thread
              a = Math.floor(Math.random() * 10) + 1;
              b = Math.floor(Math.random() * 10) + 1;
              answer = a * b;
              text = `${a} × ${b}`;
            }
            
            // Generate distractors
            const l1_distractor = answer + (Math.floor(Math.random() * 5) + 5) * (Math.random() > 0.5 ? 1 : -1);
            const l2_distractor = answer + (Math.floor(Math.random() * 3) + 1) * (Math.random() > 0.5 ? 1 : -1);
            const l3_distractor = answer + (Math.random() > 0.5 ? 1 : -1);
            
            return {
              stitch_id: stitch.id,
              text: text,
              correctAnswer: answer.toString(),
              distractors: {
                L1: l1_distractor.toString(),
                L2: l2_distractor.toString(),
                L3: l3_distractor.toString()
              }
            };
          });
          
          const { error: insertQuestionsError } = await supabase
            .from('questions')
            .upsert(questions, { onConflict: 'stitch_id, text' });
          
          if (insertQuestionsError) {
            console.error(`Error inserting questions for stitch ${stitch.id}:`, insertQuestionsError);
            return res.status(500).json({ 
              error: `Failed to insert questions for stitch ${stitch.id}`, 
              details: insertQuestionsError 
            });
          }
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Tables created and test data inserted successfully'
    });
    
  } catch (err) {
    console.error('Unexpected error creating test data:', err);
    return res.status(500).json({ error: 'Internal server error', details: err });
  }
}
/**
 * Export Bundled Content Script (Fixed Version)
 * 
 * This script exports the first 10 stitches of each tube from the database
 * to create the expanded-bundled-content.ts file with real content.
 * 
 * This version specifically ensures all questions are retrieved for each stitch.
 * 
 * Run with: node scripts/export-bundled-content-fixed.js
 */

// Supabase client
const { createClient } = require('@supabase/supabase-js');

// Use hardcoded credentials that are actually valid
const supabaseUrl = 'https://ggwoupzaruiaaliylyxga.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to log progress
function logProgress(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function exportBundledContent() {
  logProgress('Exporting bundled content from database...');
  
  try {
    // Get all tubes (1, 2, 3)
    const tubeNumbers = [1, 2, 3];
    const bundledContent = {};
    const manifest = {
      version: 1,
      generated: new Date().toISOString(),
      tubes: {},
      stats: {
        tubeCount: 3,
        threadCount: 3,
        stitchCount: 30 // 10 stitches per tube
      }
    };
    
    // For each tube, get the first thread and its first 10 stitches
    for (const tubeNumber of tubeNumbers) {
      logProgress(`Processing Tube ${tubeNumber}...`);
      
      // Get the first thread for this tube
      const { data: threads, error: threadError } = await supabase
        .from('threads')
        .select('id, title')
        .eq('tube_number', tubeNumber)
        .order('id')
        .limit(1);
      
      if (threadError) {
        console.error(`Error fetching thread for tube ${tubeNumber}:`, threadError);
        continue;
      }
      
      if (!threads || threads.length === 0) {
        console.error(`No thread found for tube ${tubeNumber}`);
        continue;
      }
      
      const thread = threads[0];
      const threadId = thread.id;
      
      logProgress(`Fetching stitches for thread ${threadId}...`);
      
      // Get the first 10 stitches for this thread, ordered by their position
      const { data: stitches, error: stitchError } = await supabase
        .from('stitches')
        .select('id, thread_id, title, content, order')
        .eq('thread_id', threadId)
        .order('order')
        .limit(10);
        
      if (stitchError) {
        console.error('Stitch fetch error details:', JSON.stringify(stitchError, null, 2));
        continue;
      }
      
      if (!stitches || stitches.length === 0) {
        console.error(`No stitches found for thread ${threadId}`);
        continue;
      }
      
      logProgress(`Found ${stitches.length} stitches for thread ${threadId}`);
      
      // Add to manifest
      if (!manifest.tubes[tubeNumber]) {
        manifest.tubes[tubeNumber] = {
          threads: {}
        };
      }
      
      manifest.tubes[tubeNumber].threads[threadId] = {
        title: thread.title || threadId,
        stitches: stitches.map(stitch => ({
          id: stitch.id,
          order: stitch.order || 0,
          title: stitch.title || stitch.id
        }))
      };
      
      // For each stitch, fetch ALL its questions separately with NO limit
      for (const stitch of stitches) {
        logProgress(`Fetching questions for stitch ${stitch.id}...`);
        
        // Fetch questions for this stitch
        const { data: questions, error: questionError } = await supabase
          .from('questions')
          .select('*')
          .eq('stitch_id', stitch.id)
          .order('id');
          
        if (questionError) {
          console.error(`Error fetching questions for stitch ${stitch.id}:`, questionError);
          continue;
        }
        
        logProgress(`Found ${questions?.length || 0} questions for stitch ${stitch.id}`);
        
        // Format questions
        const formattedQuestions = (questions || []).map(q => ({
          id: q.id,
          text: q.text || '',
          correctAnswer: q.correct_answer || '',
          distractors: {
            L1: (q.distractors && q.distractors.L1) || '',
            L2: (q.distractors && q.distractors.L2) || '',
            L3: (q.distractors && q.distractors.L3) || ''
          }
        }));
        
        // Format stitch with ALL its questions
        bundledContent[stitch.id] = {
          id: stitch.id,
          threadId: stitch.thread_id,
          title: stitch.title || '',
          content: stitch.content || '',
          order: stitch.order || 0,
          questions: formattedQuestions
        };
      }
    }
    
    // Generate the TypeScript file content
    const fileContent = `/**
 * Expanded Bundled Content
 * 
 * This file contains the actual content for the first 10 stitches of each tube,
 * exported directly from the database. This allows the app to function entirely
 * offline with a complete learning experience.
 * 
 * Generated on: ${new Date().toISOString()}
 */

import { StitchContent } from './client/content-buffer';

/**
 * Complete set of basic stitches for each tube (10 per tube × 3 tubes = 30 total)
 * These stitches are bundled with the app for immediate use without any API calls
 */
export const BUNDLED_FULL_CONTENT: Record<string, StitchContent> = ${JSON.stringify(bundledContent, null, 2)};

/**
 * Default manifest structure
 * This provides the basic structure for the first 10 stitches of each tube
 */
export const DEFAULT_MANIFEST = ${JSON.stringify(manifest, null, 2)};`;
    
    // Write to file
    const fs = require('fs');
    fs.writeFileSync('./lib/expanded-bundled-content.ts', fileContent);
    
    logProgress(`Successfully exported ${Object.keys(bundledContent).length} stitches to lib/expanded-bundled-content.ts`);
    
    // Also print stats on questions
    let totalQuestions = 0;
    const questionCounts = {};
    
    Object.entries(bundledContent).forEach(([stitchId, stitch]) => {
      const count = stitch.questions.length;
      totalQuestions += count;
      questionCounts[stitchId] = count;
    });
    
    logProgress(`Total questions exported: ${totalQuestions}`);
    logProgress('Questions per stitch:');
    console.log(JSON.stringify(questionCounts, null, 2));
  } catch (error) {
    console.error('Error exporting bundled content:', error);
  }
}

// Run the export
exportBundledContent();
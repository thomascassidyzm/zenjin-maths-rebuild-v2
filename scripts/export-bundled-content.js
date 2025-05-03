/**
 * Export Bundled Content Script
 * 
 * This script exports the first 10 stitches of each tube from the database
 * to create the expanded-bundled-content.ts file with real content.
 * 
 * Run with: node scripts/export-bundled-content.js
 */

// No need for dotenv since we're using hardcoded credentials

// Supabase client
const { createClient } = require('@supabase/supabase-js');

// Use hardcoded credentials since we have them
const supabaseUrl = 'https://ggwoupzaruiaaliylyxga.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0';

// Create Supabase client with admin privileges to bypass RLS
const supabase = createClient(supabaseUrl, supabaseKey);

async function exportBundledContent() {
  console.log('Exporting bundled content from database...');
  
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
      console.log(`Processing Tube ${tubeNumber}...`);
      
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
      
      console.log(`Fetching stitches for thread ${threadId}...`);
      // Get the first 10 stitches for this thread, ordered by their position
      const { data: stitches, error: stitchError } = await supabase
        .from('stitches')
        .select('*, questions(*)')
        .eq('thread_id', threadId)
        .order('order')
        .limit(10);
        
      if (stitchError) {
        console.error('Stitch fetch error details:', JSON.stringify(stitchError, null, 2));
      }
      
      if (stitchError) {
        console.error(`Error fetching stitches for thread ${threadId}:`, stitchError);
        continue;
      }
      
      if (!stitches || stitches.length === 0) {
        console.error(`No stitches found for thread ${threadId}`);
        continue;
      }
      
      console.log(`Found ${stitches.length} stitches for thread ${threadId}`);
      
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
      
      // Format stitches for bundled content
      stitches.forEach(stitch => {
        bundledContent[stitch.id] = {
          id: stitch.id,
          threadId: stitch.thread_id,
          title: stitch.title || '',
          content: stitch.content || '',
          order: stitch.order || 0,
          questions: (stitch.questions || []).map(q => ({
            id: q.id,
            text: q.text || '',
            correctAnswer: q.correct_answer || '',
            distractors: {
              L1: (q.distractors && q.distractors.L1) || '',
              L2: (q.distractors && q.distractors.L2) || '',
              L3: (q.distractors && q.distractors.L3) || ''
            }
          }))
        };
      });
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
    
    console.log(`Successfully exported ${Object.keys(bundledContent).length} stitches to lib/expanded-bundled-content.ts`);
  } catch (error) {
    console.error('Error exporting bundled content:', error);
  }
}

// Run the export
exportBundledContent();
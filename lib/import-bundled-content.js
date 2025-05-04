/**
 * Import Bundled Content Script
 * 
 * This script imports the bundled JSON content into the TypeScript format
 * needed for the expanded-bundled-content.ts file.
 * 
 * Run with: node lib/import-bundled-content.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const inputPath = path.join(__dirname, '..', 'bundled_content.json');
const outputPath = path.join(__dirname, 'expanded-bundled-content.ts');

// Read the bundled content JSON file
try {
  const jsonData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  
  // Handle array wrapper if present
  const bundledContent = Array.isArray(jsonData) ? jsonData[0].bundled_content : jsonData.bundled_content;
  
  // Check if the content has the expected structure
  if (!bundledContent || !bundledContent.stitches) {
    console.error('Error: bundled_content.json does not have the expected structure. Missing "bundled_content.stitches" property.');
    process.exit(1);
  }
  
  // Collect the stitches by tube for the manifest
  const stitchesByTube = {};
  const threadsByTube = {};
  
  // Process the stitches
  Object.values(bundledContent.stitches).forEach(stitch => {
    // Extract tube number from thread id (assuming thread ids follow "thread-T{tube_number}-...")
    const match = stitch.threadId.match(/thread-T(\d+)-/);
    if (match) {
      const tubeNumber = match[1];
      
      // Initialize tube if not exists
      if (!stitchesByTube[tubeNumber]) {
        stitchesByTube[tubeNumber] = [];
      }
      
      // Add stitch to tube
      stitchesByTube[tubeNumber].push({
        id: stitch.id,
        order: stitch.order,
        title: stitch.title
      });
      
      // Track threads by tube
      if (!threadsByTube[tubeNumber]) {
        threadsByTube[tubeNumber] = {};
      }
      
      if (!threadsByTube[tubeNumber][stitch.threadId]) {
        threadsByTube[tubeNumber][stitch.threadId] = {
          title: stitch.title.split(' ')[0], // Use first word of stitch title as thread title
          stitches: []
        };
      }
      
      threadsByTube[tubeNumber][stitch.threadId].stitches.push({
        id: stitch.id,
        order: stitch.order,
        title: stitch.title
      });
    }
  });
  
  // Create the manifest
  const manifest = {
    version: 1,
    generated: new Date().toISOString(),
    tubes: {},
    stats: {
      tubeCount: Object.keys(stitchesByTube).length,
      threadCount: Object.values(threadsByTube).reduce((sum, threads) => sum + Object.keys(threads).length, 0),
      stitchCount: Object.values(bundledContent.stitches).length
    }
  };
  
  // Add threads to manifest
  Object.entries(threadsByTube).forEach(([tubeNumber, threads]) => {
    manifest.tubes[tubeNumber] = {
      threads: threads
    };
  });
  
  // Create the TypeScript content
  const tsContent = `/**
 * Expanded Bundled Content
 * 
 * This file contains the first 10 stitches of each tube (30 total stitches).
 * These are bundled with the app for immediate offline use.
 * 
 * Generated on: ${new Date().toISOString()}
 */

import { StitchContent } from './client/content-buffer';

/**
 * Complete set of basic stitches for each tube (10 per tube × 3 tubes = 30 total)
 * These stitches are bundled with the app for immediate use without any API calls
 */
export const BUNDLED_FULL_CONTENT: Record<string, StitchContent> = ${JSON.stringify(bundledContent.stitches, null, 2)};

/**
 * Default manifest structure
 * This provides the basic structure for the first 10 stitches of each tube
 */
export const DEFAULT_MANIFEST = ${JSON.stringify(manifest, null, 2)};`;

  // Write the TypeScript file
  fs.writeFileSync(outputPath, tsContent);
  console.log(`Successfully imported bundled content to ${outputPath}`);
  
} catch (error) {
  console.error('Error processing bundled content:', error);
}
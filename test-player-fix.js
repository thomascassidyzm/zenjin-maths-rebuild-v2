/**
 * Verification Script for MinimalDistinctionPlayer Fix
 * 
 * This script checks if the MinimalDistinctionPlayer component 
 * correctly uses bundled content from expanded-bundled-content.ts
 */

const fs = require('fs');
const path = require('path');

// Function to check if the fix has been correctly implemented
function verifyMinimalDistinctionPlayerFix() {
  console.log('Verifying MinimalDistinctionPlayer Fix...');

  try {
    // Check if MinimalDistinctionPlayer imports the BUNDLED_FULL_CONTENT
    const playerPath = path.join(__dirname, 'components', 'MinimalDistinctionPlayer.tsx');
    const playerContent = fs.readFileSync(playerPath, 'utf8');

    // 1. Check for import
    const hasImport = playerContent.includes("import { BUNDLED_FULL_CONTENT } from '../lib/expanded-bundled-content'");
    console.log(`1. Import statement present: ${hasImport ? '✅ Yes' : '❌ No'}`);

    // 2. Check for bundled content usage
    const usesBundledContent = playerContent.includes("BUNDLED_FULL_CONTENT[stitch.id]");
    console.log(`2. Uses bundled content: ${usesBundledContent ? '✅ Yes' : '❌ No'}`);

    // 3. Check for priority of bundled content over thread content
    const prioritizesBundled = playerContent.includes("if (BUNDLED_FULL_CONTENT[stitch.id] && BUNDLED_FULL_CONTENT[stitch.id].questions");
    console.log(`3. Prioritizes bundled content: ${prioritizesBundled ? '✅ Yes' : '❌ No'}`);

    // 4. Check that the original code as fallback is present 
    const hasFallback = playerContent.includes("Fallback to checking passed-in questions when stitch is not in bundled content");
    console.log(`4. Has fallback mechanism: ${hasFallback ? '✅ Yes' : '❌ No'}`);

    console.log('\nChecking expanded-bundled-content.ts...');
    
    // Check bundled content file
    const bundledPath = path.join(__dirname, 'lib', 'expanded-bundled-content.ts');
    const bundledContent = fs.readFileSync(bundledPath, 'utf8');

    // 5. Check that the bundled content file has content
    const hasContent = bundledContent.includes('BUNDLED_FULL_CONTENT');
    console.log(`5. Bundled content defined: ${hasContent ? '✅ Yes' : '❌ No'}`);

    // 6. Roughly check if it contains question arrays
    const hasQuestions = bundledContent.includes('"questions": [');
    console.log(`6. Contains question arrays: ${hasQuestions ? '✅ Yes' : '❌ No'}`);

    // 7. Try to estimate number of questions per stitch
    let contentMatch = bundledContent.match(/stitch-T1-001-01-q\d+"/g) || [];
    console.log(`7. Questions in stitch-T1-001-01: ${contentMatch.length} questions`);

    contentMatch = bundledContent.match(/stitch-T2-001-01-q\d+"/g) || [];
    console.log(`   Questions in stitch-T2-001-01: ${contentMatch.length} questions`);

    contentMatch = bundledContent.match(/stitch-T3-001-01-q\d+"/g) || [];
    console.log(`   Questions in stitch-T3-001-01: ${contentMatch.length} questions`);

    console.log('\nSummary:');
    if (hasImport && usesBundledContent && prioritizesBundled && hasFallback && hasContent && hasQuestions) {
      console.log('✅ The fix appears to be correctly implemented!');
      console.log('   - MinimalDistinctionPlayer now imports BUNDLED_FULL_CONTENT');
      console.log('   - It prioritizes bundled content over thread prop content');
      console.log('   - It falls back to thread prop content if bundled content not available');
      console.log('\nNext steps: Deploy the changes and test in the actual application.');
    } else {
      console.log('❌ The fix is not completely implemented. Please check the issues above.');
    }

  } catch (error) {
    console.error('Error verifying fix:', error);
  }
}

// Run the verification
verifyMinimalDistinctionPlayerFix();
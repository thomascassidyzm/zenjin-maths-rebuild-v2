const fs = require('fs');

// Read the file content
const fileContent = fs.readFileSync('./lib/expanded-bundled-content.ts', 'utf8');

// Extract the BUNDLED_FULL_CONTENT object from the file
const contentMatch = fileContent.match(/export const BUNDLED_FULL_CONTENT: Record<string, StitchContent> = ({[\s\S]*?});/);
if (!contentMatch) {
  console.error('Could not extract BUNDLED_FULL_CONTENT from the file');
  process.exit(1);
}

// Parse the JSON content (need to eval since it's not valid JSON due to being TypeScript)
const content = eval(`(${contentMatch[1]})`);

// Count questions for each stitch
const counts = {};
Object.entries(content).forEach(([id, stitch]) => {
  counts[id] = stitch.questions ? stitch.questions.length : 0;
});

// Print the counts
console.log('Question counts per stitch:');
console.log(counts);

// Calculate statistics
const values = Object.values(counts);
const min = Math.min(...values);
const max = Math.max(...values);
const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

console.log('\nStatistics:');
console.log(`Total stitches: ${Object.keys(counts).length}`);
console.log(`Min questions: ${min}`);
console.log(`Max questions: ${max}`);
console.log(`Average questions: ${avg.toFixed(2)}`);

// List stitches with less than 20 questions
const lowQuestionStitches = Object.entries(counts)
  .filter(([_, count]) => count < 20)
  .map(([id, count]) => ({ id, count }));

if (lowQuestionStitches.length > 0) {
  console.log('\nStitches with fewer than 20 questions:');
  console.log(lowQuestionStitches);
}
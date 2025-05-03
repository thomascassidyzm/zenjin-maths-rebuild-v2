/**
 * Test driver for PositionBasedStateMachine
 * 
 * This script creates sample data and tests the core functionality
 * of the position-based state machine implementation.
 * 
 * Run with: node test-position-based.js
 */

// Import both state machine implementations for comparison
const StateMachine = require('./lib/triple-helix/StateMachine');
const PositionBasedStateMachine = require('./lib/triple-helix/PositionBasedStateMachine');

// Test data - mock stitch data for testing
const createTestData = () => {
  return {
    userId: 'test-user-1',
    activeTubeNumber: 1,
    cycleCount: 0,
    tubes: {
      1: {
        threadId: 'thread-T1-001',
        currentStitchId: 'stitch-T1-001-01',
        stitches: [
          { id: 'stitch-T1-001-01', position: 0, skipNumber: 3, distractorLevel: 'L1' },
          { id: 'stitch-T1-001-02', position: 1, skipNumber: 1, distractorLevel: 'L1' },
          { id: 'stitch-T1-001-03', position: 2, skipNumber: 3, distractorLevel: 'L1' },
          { id: 'stitch-T1-001-04', position: 3, skipNumber: 3, distractorLevel: 'L1' },
          { id: 'stitch-T1-001-05', position: 4, skipNumber: 5, distractorLevel: 'L2' },
          { id: 'stitch-T1-001-06', position: 5, skipNumber: 3, distractorLevel: 'L1' },
        ]
      },
      2: {
        threadId: 'thread-T2-001',
        currentStitchId: 'stitch-T2-001-01',
        stitches: [
          { id: 'stitch-T2-001-01', position: 0, skipNumber: 3, distractorLevel: 'L1' },
          { id: 'stitch-T2-001-02', position: 1, skipNumber: 1, distractorLevel: 'L1' },
          { id: 'stitch-T2-001-03', position: 2, skipNumber: 3, distractorLevel: 'L1' },
        ]
      },
      3: {
        threadId: 'thread-T3-001',
        currentStitchId: 'stitch-T3-001-01',
        stitches: [
          { id: 'stitch-T3-001-01', position: 0, skipNumber: 3, distractorLevel: 'L1' },
          { id: 'stitch-T3-001-02', position: 1, skipNumber: 1, distractorLevel: 'L1' },
          { id: 'stitch-T3-001-03', position: 2, skipNumber: 3, distractorLevel: 'L1' },
        ]
      }
    }
  };
};

// Function to run tests and compare results
const runTests = () => {
  console.log('=========================================');
  console.log('POSITION-BASED STATE MACHINE TEST DRIVER');
  console.log('=========================================\n');

  // Create both state machine instances with the same test data
  const testData = createTestData();
  
  console.log('Creating state machines...');
  const legacyStateMachine = new StateMachine(testData);
  const positionBasedStateMachine = new PositionBasedStateMachine(testData);
  
  // Test 1: Compare initial state
  console.log('\n--------- TEST 1: INITIAL STATE ---------');
  console.log('Legacy current stitch:', legacyStateMachine.getCurrentStitch());
  console.log('Position-based current stitch:', positionBasedStateMachine.getCurrentStitch());
  
  // Test 2: Stitch completion with perfect score
  console.log('\n--------- TEST 2: PERFECT SCORE STITCH COMPLETION ---------');
  const threadId = 'thread-T1-001';
  const stitchId = 'stitch-T1-001-01';
  
  console.log('Starting stitch completion flow with perfect score (20/20)...');
  
  // Complete stitch in both state machines
  const legacyResult = legacyStateMachine.handleStitchCompletion(threadId, stitchId, 20, 20);
  const positionResult = positionBasedStateMachine.handleStitchCompletion(threadId, stitchId, 20, 20);
  
  console.log('\nAfter completion:');
  console.log('Legacy new current stitch:', legacyResult);
  console.log('Position-based new current stitch:', positionResult);
  
  // Test 3: Check stitch order in tube 1
  console.log('\n--------- TEST 3: CHECK STITCH ORDER AFTER ADVANCEMENT ---------');
  
  console.log('\nLegacy tube 1 stitches:');
  const legacyStitches = legacyStateMachine.getStitchesForTube(1);
  legacyStitches.forEach((stitch, index) => {
    if (index < 6) console.log(`  ${index}. Position ${stitch.position}: ${stitch.id} (Skip=${stitch.skipNumber})`);
  });
  
  console.log('\nPosition-based tube 1 stitches:');
  const positionStitches = positionBasedStateMachine.getStitchesForTube(1);
  positionStitches.forEach((stitch, index) => {
    if (index < 6) console.log(`  ${index}. Position ${stitch.position}: ${stitch.id} (Skip=${stitch.skipNumber})`);
  });
  
  // Test 4: Cycle tubes
  console.log('\n--------- TEST 4: CYCLE TUBES ---------');
  
  console.log('Starting tube cycling...');
  
  // Cycle tubes in both state machines
  const legacyCycleResult = legacyStateMachine.cycleTubes();
  const positionCycleResult = positionBasedStateMachine.cycleTubes();
  
  console.log('\nAfter cycling:');
  console.log('Legacy new tube:', legacyStateMachine.getCurrentTubeNumber());
  console.log('Legacy current stitch:', legacyCycleResult);
  console.log('Position-based new tube:', positionBasedStateMachine.getCurrentTubeNumber());
  console.log('Position-based current stitch:', positionCycleResult);
  
  // Test 5: Repeated perfect scores
  console.log('\n--------- TEST 5: MULTIPLE PERFECT SCORES ---------');
  
  // Complete 3 stitches with perfect scores in tube 2
  console.log('Completing 3 stitches with perfect scores in tube 2...');
  
  // First stitch
  const legacyStitch1 = legacyStateMachine.handleStitchCompletion('thread-T2-001', 'stitch-T2-001-01', 20, 20);
  const positionStitch1 = positionBasedStateMachine.handleStitchCompletion('thread-T2-001', 'stitch-T2-001-01', 20, 20);
  
  // Second stitch
  const legacyStitch2 = legacyStateMachine.handleStitchCompletion('thread-T2-001', 'stitch-T2-001-02', 20, 20);
  const positionStitch2 = positionBasedStateMachine.handleStitchCompletion('thread-T2-001', 'stitch-T2-001-02', 20, 20);
  
  console.log('\nAfter 2 perfect scores:');
  console.log('Legacy tube 2 stitches:');
  const legacyTube2 = legacyStateMachine.getStitchesForTube(2);
  legacyTube2.forEach((stitch, index) => console.log(`  ${index}. Position ${stitch.position}: ${stitch.id} (Skip=${stitch.skipNumber})`));
  
  console.log('\nPosition-based tube 2 stitches:');
  const positionTube2 = positionBasedStateMachine.getStitchesForTube(2);
  positionTube2.forEach((stitch, index) => console.log(`  ${index}. Position ${stitch.position}: ${stitch.id} (Skip=${stitch.skipNumber})`));
  
  // Test 6: Format conversion
  console.log('\n--------- TEST 6: FORMAT CONVERSION ---------');
  
  // Convert position-based to legacy
  const convertedLegacy = positionBasedStateMachine.toLegacyFormat();
  
  console.log('\nPosition-based converted to legacy format:');
  console.log('Active tube:', convertedLegacy.activeTubeNumber);
  Object.entries(convertedLegacy.tubes).forEach(([tubeNum, tube]) => {
    console.log(`\nTube ${tubeNum}:`);
    console.log(`  Thread ID: ${tube.threadId}`);
    console.log(`  Current Stitch ID: ${tube.currentStitchId}`);
    console.log(`  Stitches: ${tube.stitches.length}`);
    
    if (tube.stitches.length > 0) {
      console.log('\n  First 3 stitches:');
      tube.stitches.slice(0, 3).forEach((stitch, index) => {
        console.log(`    ${index}. Position ${stitch.position}: ${stitch.id} (Skip=${stitch.skipNumber})`);
      });
    }
  });
  
  // Final status check
  console.log('\n=========================================');
  console.log('TEST SUMMARY:');
  console.log('=========================================');
  
  let successCount = 0;
  const totalTests = 6;
  
  // Test 1 check
  if (positionBasedStateMachine.getCurrentStitch()?.id === legacyStateMachine.getCurrentStitch()?.id) {
    console.log('✅ Test 1: Initial state matches');
    successCount++;
  } else {
    console.log('❌ Test 1: Initial state mismatch');
  }
  
  // Test 2 check
  if (positionResult?.id === legacyResult?.id) {
    console.log('✅ Test 2: Stitch completion produces matching results');
    successCount++;
  } else {
    console.log('❌ Test 2: Stitch completion results mismatch');
  }
  
  // Test 3 check
  const legacyOrder = legacyStitches.map(s => s.id).join(',');
  const positionOrder = positionStitches.map(s => s.id).join(',');
  if (positionOrder === legacyOrder) {
    console.log('✅ Test 3: Stitch order matches after advancement');
    successCount++;
  } else {
    console.log('❌ Test 3: Stitch order mismatch after advancement');
  }
  
  // Test 4 check
  if (positionCycleResult?.id === legacyCycleResult?.id) {
    console.log('✅ Test 4: Tube cycling produces matching results');
    successCount++;
  } else {
    console.log('❌ Test 4: Tube cycling results mismatch');
  }
  
  // Test 5 check - just verify no position conflicts
  const positionPositions = positionTube2.map(s => s.position);
  const uniquePositions = new Set(positionPositions);
  if (positionPositions.length === uniquePositions.size) {
    console.log('✅ Test 5: No position conflicts after multiple perfect scores');
    successCount++;
  } else {
    console.log('❌ Test 5: Position conflicts detected after multiple perfect scores');
  }
  
  // Test 6 check - verify conversion has correct structure
  if (
    convertedLegacy.tubes && 
    convertedLegacy.tubes[1] && 
    Array.isArray(convertedLegacy.tubes[1].stitches) &&
    convertedLegacy.tubes[1].currentStitchId
  ) {
    console.log('✅ Test 6: Conversion to legacy format is structurally valid');
    successCount++;
  } else {
    console.log('❌ Test 6: Conversion to legacy format has structural issues');
  }
  
  console.log(`\nOverall Result: ${successCount}/${totalTests} tests passed`);
  
  if (successCount === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! The position-based implementation is functioning correctly.');
  } else {
    console.log('\n⚠️ SOME TESTS FAILED! Review the logs above for details.');
  }
};

// Run the tests
runTests();
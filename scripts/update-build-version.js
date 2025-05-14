/**
 * Script to update build version before each build
 * This script automatically increments the patch version in package.json
 */

const fs = require('fs');
const path = require('path');

// Function to increment version
function incrementVersion(version) {
  const parts = version.split('.');
  let [major, minor, patch] = parts.map(p => parseInt(p, 10));
  
  // Increment patch version
  patch += 1;
  
  return `${major}.${minor}.${patch}`;
}

// Path to package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Read the package.json file
fs.readFile(packageJsonPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading package.json:', err);
    process.exit(1);
  }
  
  try {
    // Parse the package.json content
    const packageJson = JSON.parse(data);
    
    // Get the current version
    const currentVersion = packageJson.version;
    
    // Increment the version
    const newVersion = incrementVersion(currentVersion);
    
    // Update the version in package.json
    packageJson.version = newVersion;
    
    // Add build timestamp
    packageJson.buildTimestamp = new Date().toISOString();
    
    // Write the updated package.json
    fs.writeFile(
      packageJsonPath, 
      JSON.stringify(packageJson, null, 2) + '\n', 
      'utf8', 
      (writeErr) => {
        if (writeErr) {
          console.error('Error writing package.json:', writeErr);
          process.exit(1);
        }
        
        console.log(`✅ Version updated: ${currentVersion} → ${newVersion}`);
      }
    );
  } catch (parseErr) {
    console.error('Error parsing package.json:', parseErr);
    process.exit(1);
  }
});
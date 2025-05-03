import React, { useState } from 'react';
import { BUNDLED_FULL_CONTENT, DEFAULT_MANIFEST } from '../lib/expanded-bundled-content';

/**
 * Simple Offline Test Page
 * 
 * This page displays the content from expanded-bundled-content.ts without 
 * relying on any other components or dependencies.
 */
export default function SimpleOfflineTest() {
  const [activeStitchId, setActiveStitchId] = useState('stitch-T1-001-01');
  const [activeTube, setActiveTube] = useState(1);
  
  // Get the list of stitches for the active tube
  const getStitchesForTube = (tubeNumber) => {
    const tubeManifest = DEFAULT_MANIFEST.tubes[tubeNumber];
    if (!tubeManifest) return [];
    
    // Get the first thread in this tube
    const threadId = Object.keys(tubeManifest.threads)[0];
    if (!threadId) return [];
    
    // Return the stitches from this thread
    return tubeManifest.threads[threadId].stitches || [];
  };
  
  // Get the active stitch content
  const activeStitch = BUNDLED_FULL_CONTENT[activeStitchId] || null;
  
  // Handle stitch selection
  const handleStitchSelect = (stitchId) => {
    setActiveStitchId(stitchId);
  };
  
  // Handle tube change
  const handleTubeChange = (tubeNumber) => {
    setActiveTube(tubeNumber);
    
    // Select the first stitch in this tube
    const stitches = getStitchesForTube(tubeNumber);
    if (stitches.length > 0) {
      setActiveStitchId(stitches[0].id);
    }
  };
  
  return (
    <div className="simple-offline-test">
      <h1>Simple Offline Content Test</h1>
      
      <div className="stats-panel">
        <h2>Content Statistics</h2>
        <ul>
          <li><strong>Total Stitches:</strong> {Object.keys(BUNDLED_FULL_CONTENT).length}</li>
          <li><strong>Tubes:</strong> {DEFAULT_MANIFEST.stats.tubeCount}</li>
          <li><strong>Threads:</strong> {DEFAULT_MANIFEST.stats.threadCount}</li>
        </ul>
      </div>
      
      <div className="content-explorer">
        <div className="tube-selector">
          <h2>Select Tube</h2>
          <div className="button-group">
            {Object.keys(DEFAULT_MANIFEST.tubes).map(tubeNumber => (
              <button 
                key={tubeNumber}
                onClick={() => handleTubeChange(Number(tubeNumber))}
                className={activeTube === Number(tubeNumber) ? 'active' : ''}
              >
                Tube {tubeNumber}
              </button>
            ))}
          </div>
        </div>
        
        <div className="stitch-selector">
          <h2>Stitches for Tube {activeTube}</h2>
          <div className="stitch-list">
            {getStitchesForTube(activeTube).map(stitch => (
              <div 
                key={stitch.id}
                onClick={() => handleStitchSelect(stitch.id)}
                className={`stitch-item ${activeStitchId === stitch.id ? 'active' : ''}`}
              >
                {stitch.title || stitch.id}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="active-stitch">
        <h2>Active Stitch Content</h2>
        {activeStitch ? (
          <div className="stitch-content">
            <h3>{activeStitch.title}</h3>
            <div className="content-box">
              {activeStitch.content}
            </div>
            
            <h4>Questions:</h4>
            <div className="questions">
              {activeStitch.questions.map((question, index) => (
                <div key={index} className="question-box">
                  <p className="question-text">{question.text}</p>
                  <div className="answer-options">
                    <div className="answer correct">
                      <strong>Correct:</strong> {question.correctAnswer}
                    </div>
                    <div className="distractors">
                      <strong>Distractors:</strong>
                      <ul>
                        <li>L1: {question.distractors.L1}</li>
                        <li>L2: {question.distractors.L2}</li>
                        <li>L3: {question.distractors.L3}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="no-stitch">No stitch selected</div>
        )}
      </div>
      
      <style jsx>{`
        .simple-offline-test {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        h1 {
          color: #333;
          border-bottom: 2px solid #eee;
          padding-bottom: 10px;
        }
        
        h2 {
          color: #555;
          margin-top: 20px;
        }
        
        .stats-panel {
          background: #f9f9f9;
          border: 1px solid #eee;
          border-radius: 4px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        ul {
          list-style-type: none;
          padding: 0;
        }
        
        li {
          margin-bottom: 5px;
        }
        
        .content-explorer {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .tube-selector, .stitch-selector {
          flex: 1;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
        }
        
        button {
          padding: 8px 16px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }
        
        button.active {
          background: #4a90e2;
          color: white;
          border-color: #2a70c2;
        }
        
        .stitch-list {
          border: 1px solid #ddd;
          border-radius: 4px;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .stitch-item {
          padding: 8px 12px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
        }
        
        .stitch-item:hover {
          background: #f5f5f5;
        }
        
        .stitch-item.active {
          background: #e0f0ff;
          font-weight: bold;
        }
        
        .active-stitch {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 20px;
        }
        
        .content-box {
          background: #f9f9f9;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        
        .question-box {
          background: #f0f7ff;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 15px;
          border-left: 4px solid #4a90e2;
        }
        
        .question-text {
          font-weight: bold;
          font-size: 1.1em;
          margin-bottom: 10px;
        }
        
        .answer-options {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }
        
        .answer {
          flex: 1;
          min-width: 200px;
        }
        
        .correct {
          color: #2a8d4e;
        }
        
        .distractors {
          flex: 2;
        }
        
        .no-stitch {
          color: #999;
          font-style: italic;
          text-align: center;
          padding: 30px;
        }
      `}</style>
    </div>
  );
}
import React, { useState, useEffect } from 'react';

const TestContentLoadingPage: React.FC = () => {
  // Content manager reference
  const [contentManager, setContentManager] = useState<any>(null);
  
  // Test data state
  const [testStitchId, setTestStitchId] = useState<string>('stitch-001');
  const [batchSize, setBatchSize] = useState<number>(5);
  const [prefetchEnabled, setPrefetchEnabled] = useState<boolean>(true);
  
  // Result state
  const [loadedStitch, setLoadedStitch] = useState<any>(null);
  const [loadedBatch, setLoadedBatch] = useState<any[]>([]);
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  
  // Performance metrics
  const [singleLoadTime, setSingleLoadTime] = useState<number>(0);
  const [batchLoadTime, setBatchLoadTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Messages
  const [messages, setMessages] = useState<string[]>([]);
  
  // Service worker status
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<string>('Checking...');
  
  // Load content manager
  useEffect(() => {
    import('../lib/content/contentManager').then(mod => {
      setContentManager(mod.contentManager);
    });
  }, []);
  
  // Initialize
  useEffect(() => {
    // Only proceed if content manager is loaded
    if (!contentManager) return;
    
    // Check service worker status
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        if (registrations.length > 0) {
          setServiceWorkerStatus(`Registered (${registrations.length})`);
        } else {
          setServiceWorkerStatus('Not registered');
        }
      }).catch(err => {
        setServiceWorkerStatus(`Error: ${err.message}`);
      });
    } else {
      setServiceWorkerStatus('Not supported');
    }
    
    // Get initial cache status
    updateCacheStatus();
    
    // Add message about worker initialization
    addMessage('Content manager initialized');
  }, [contentManager]);
  
  // Add a message to the log
  const addMessage = (message: string) => {
    setMessages(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 9)]);
  };
  
  // Update cache status
  const updateCacheStatus = async () => {
    if (!contentManager) {
      addMessage('Content manager not yet loaded');
      return;
    }
    
    try {
      const status = await contentManager.getCacheStatus();
      setCacheStatus(status);
      addMessage('Cache status updated');
    } catch (error: any) {
      console.error('Error getting cache status:', error);
      addMessage(`Error: ${error.message}`);
    }
  };
  
  // Generate a batch of test stitch IDs
  const generateTestBatch = (size: number): string[] => {
    const batch: string[] = [];
    for (let i = 0; i < size; i++) {
      batch.push(`stitch-${(i + 1).toString().padStart(3, '0')}`);
    }
    return batch;
  };
  
  // Load a single stitch
  const loadSingleStitch = async () => {
    try {
      setIsLoading(true);
      addMessage(`Loading stitch: ${testStitchId}`);
      
      const startTime = performance.now();
      
      // Use mock data for testing without an actual API
      // In a real implementation, this would be handled by 
      // the content manager's fetching logic
      const stitch = await mockFetchStitch(testStitchId);
      
      const endTime = performance.now();
      
      setLoadedStitch(stitch);
      setSingleLoadTime(endTime - startTime);
      addMessage(`Loaded stitch in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Update cache status after loading
      updateCacheStatus();
    } catch (error: any) {
      console.error('Error loading stitch:', error);
      addMessage(`Error loading stitch: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load a batch of stitches
  const loadBatch = async () => {
    try {
      setIsLoading(true);
      const batchIds = generateTestBatch(batchSize);
      addMessage(`Loading batch of ${batchIds.length} stitches`);
      
      const startTime = performance.now();
      
      // Use mock data for testing without an actual API
      // In a real implementation, this would use the content manager
      const stitches = await mockFetchBatch(batchIds);
      
      const endTime = performance.now();
      
      setLoadedBatch(stitches);
      setBatchLoadTime(endTime - startTime);
      addMessage(`Loaded batch in ${(endTime - startTime).toFixed(2)}ms`);
      
      // If prefetch enabled, prefetch the next set
      if (prefetchEnabled) {
        const nextBatchIds = generateTestBatch(batchSize).map(id => {
          // Generate IDs for the next batch (just adding 100 for testing)
          const idNumber = parseInt(id.split('-')[1]);
          return `stitch-${(idNumber + 100).toString().padStart(3, '0')}`;
        });
        
        // Queue for prefetch
        addMessage(`Queueing ${nextBatchIds.length} stitches for prefetch`);
        await mockPrefetchStitches(nextBatchIds);
      }
      
      // Update cache status after loading
      updateCacheStatus();
    } catch (error: any) {
      console.error('Error loading batch:', error);
      addMessage(`Error loading batch: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Clear cache
  const clearCache = async () => {
    if (!contentManager) {
      addMessage('Content manager not yet loaded');
      return;
    }
    
    try {
      addMessage('Clearing cache...');
      await contentManager.clearOldCache();
      addMessage('Cache cleared');
      
      // Update cache status
      updateCacheStatus();
    } catch (error: any) {
      console.error('Error clearing cache:', error);
      addMessage(`Error clearing cache: ${error.message}`);
    }
  };
  
  // Mock fetch functions for testing without a real API
  // In a real implementation, these would be handled by the content manager
  
  const mockFetchStitch = async (stitchId: string): Promise<any> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    
    // Generate mock stitch data
    return {
      id: stitchId,
      name: `Test Stitch ${stitchId}`,
      description: `A test stitch with ID ${stitchId}`,
      threadId: 'thread-001',
      orderNumber: parseInt(stitchId.split('-')[1] || '0'),
      questions: [
        {
          id: `q-${stitchId}-1`,
          text: 'What is 2+2?',
          correctAnswer: '4',
          distractors: {
            L1: '3',
            L2: '5',
            L3: '22'
          }
        },
        {
          id: `q-${stitchId}-2`,
          text: 'What is 5×5?',
          correctAnswer: '25',
          distractors: {
            L1: '20',
            L2: '10',
            L3: '55'
          }
        }
      ]
    };
  };
  
  const mockFetchBatch = async (stitchIds: string[]): Promise<any[]> => {
    // Simulate network delay - slightly longer for batch
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400));
    
    // Generate mock stitches
    const stitches = await Promise.all(
      stitchIds.map(id => mockFetchStitch(id))
    );
    
    return stitches;
  };
  
  const mockPrefetchStitches = async (stitchIds: string[]): Promise<void> => {
    // Just simulate the call, no actual data needed for the test
    await new Promise(resolve => setTimeout(resolve, 100));
    return;
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Content Loading Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-100 rounded p-4">
          <h2 className="text-lg font-semibold mb-4">System Status</h2>
          
          <div className="mb-4">
            <p><strong>Service Worker:</strong> {serviceWorkerStatus}</p>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-1">Content Cache Status</h3>
            {cacheStatus ? (
              <div>
                <p><strong>Worker Available:</strong> {cacheStatus.workerAvailable ? 'Yes' : 'No'}</p>
                <p><strong>Memory Cache Size:</strong> {cacheStatus.memCacheSize} items</p>
                <p><strong>Worker Cache Size:</strong> {cacheStatus.cacheSize || 'N/A'} items</p>
                <p><strong>Queue Length:</strong> {cacheStatus.queueLength || 0} items</p>
                <p><strong>Is Fetching:</strong> {cacheStatus.isFetching ? 'Yes' : 'No'}</p>
              </div>
            ) : (
              <p>Loading...</p>
            )}
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={updateCacheStatus}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Status
            </button>
            <button 
              onClick={clearCache}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear Cache
            </button>
          </div>
        </div>
        
        <div className="bg-gray-100 rounded p-4">
          <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-medium mb-1">Single Stitch Load</h3>
              <p className="text-xl">{singleLoadTime.toFixed(2)} ms</p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Batch Load ({batchSize} items)</h3>
              <p className="text-xl">{batchLoadTime.toFixed(2)} ms</p>
              <p className="text-sm text-gray-600">
                {batchLoadTime > 0 ? `${(batchLoadTime / batchSize).toFixed(2)} ms per item` : '-'}
              </p>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium mb-1">Log</h3>
            <div className="bg-gray-800 text-green-400 p-2 rounded font-mono text-xs h-32 overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className="mb-1">{msg}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-100 rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Single Stitch Loading</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stitch ID:
            </label>
            <input
              type="text"
              value={testStitchId}
              onChange={(e) => setTestStitchId(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <button 
            onClick={loadSingleStitch}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load Stitch'}
          </button>
          
          {loadedStitch && (
            <div className="mt-4 bg-white p-3 rounded border">
              <h3 className="font-medium">{loadedStitch.name}</h3>
              <p className="text-sm text-gray-700 mb-2">{loadedStitch.description}</p>
              <div className="text-xs text-gray-500">
                <p>ID: {loadedStitch.id}</p>
                <p>Thread: {loadedStitch.threadId}</p>
                <p>Questions: {loadedStitch.questions.length}</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-gray-100 rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Batch Loading</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch Size:
            </label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 1)}
              min="1"
              max="20"
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={prefetchEnabled}
                onChange={(e) => setPrefetchEnabled(e.target.checked)}
                className="mr-2"
              />
              <span>Enable Prefetching</span>
            </label>
          </div>
          
          <button 
            onClick={loadBatch}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load Batch'}
          </button>
          
          {loadedBatch.length > 0 && (
            <div className="mt-4 bg-white p-3 rounded border">
              <h3 className="font-medium">Loaded {loadedBatch.length} stitches</h3>
              <div className="max-h-40 overflow-y-auto mt-2">
                {loadedBatch.map(stitch => (
                  <div key={stitch.id} className="text-xs border-b pb-1 mb-1">
                    <p className="font-medium">{stitch.name}</p>
                    <p className="text-gray-500">ID: {stitch.id}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-gray-100 rounded p-4 mb-8">
        <h2 className="text-lg font-semibold mb-2">Documentation</h2>
        
        <div className="text-sm">
          <p className="mb-2">This page tests the progressive content loading architecture which includes:</p>
          <ul className="list-disc pl-5 mb-4">
            <li>Web worker based content loading for non-blocking performance</li>
            <li>Multi-layer caching (memory, IndexedDB, Cache API via Service Worker)</li>
            <li>Intelligent prefetching of likely-to-be-needed content</li>
            <li>Offline support with transparent fallbacks</li>
          </ul>
          
          <p className="mb-2"><strong>Note:</strong> This test page uses mock data since it may not have access to the actual API endpoints during testing.</p>
        </div>
      </div>
    </div>
  );
};

export default TestContentLoadingPage;
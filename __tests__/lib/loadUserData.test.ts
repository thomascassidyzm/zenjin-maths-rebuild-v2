/**
 * User Data Loading Utility Tests
 * 
 * Tests the centralized data loading utility functions that handle user-specific
 * data loading, local caching, and offline support.
 */

import { loadUserData, hasLocalUserData, getLocalUserData, clearUserData } from '../../lib/loadUserData';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key]),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    _getStore: () => store
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock console methods
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

describe('User Data Loading Utility', () => {
  // Sample data for tests
  const mockTubeConfigData = {
    tubes: {
      1: {
        threadId: 'thread-T1-001',
        currentStitchId: 'stitch-T1-001-01',
        stitches: [
          { id: 'stitch-T1-001-01', position: 0 },
          { id: 'stitch-T1-001-02', position: 1 }
        ]
      },
      2: {
        threadId: 'thread-T2-001',
        currentStitchId: 'stitch-T2-001-01',
        stitches: [
          { id: 'stitch-T2-001-01', position: 0 }
        ]
      },
      3: {
        threadId: 'thread-T3-001',
        currentStitchId: 'stitch-T3-001-01',
        stitches: [
          { id: 'stitch-T3-001-01', position: 0 }
        ]
      }
    },
    threads: [
      {
        id: 'thread-T1-001',
        title: 'Numbers 1-10',
        tubeNumber: 1
      },
      {
        id: 'thread-T2-001',
        title: 'Addition',
        tubeNumber: 2
      },
      {
        id: 'thread-T3-001',
        title: 'Subtraction',
        tubeNumber: 3
      }
    ],
    stitches: [
      {
        id: 'stitch-T1-001-01',
        threadId: 'thread-T1-001',
        title: 'Number 1',
        questions: [{ id: 'q1', text: 'What is 1?', correctAnswer: 'One' }]
      },
      {
        id: 'stitch-T1-001-02',
        threadId: 'thread-T1-001',
        title: 'Number 2',
        questions: [{ id: 'q2', text: 'What is 2?', correctAnswer: 'Two' }]
      }
    ]
  };

  const mockProgressData = {
    totalPoints: 120,
    blinkSpeed: 3,
    evolution: {
      level: 2,
      name: 'Math Explorer',
      progress: 45
    },
    recentSessions: [
      {
        date: '2025-05-01',
        points: 25,
        duration: 300
      }
    ]
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    localStorageMock.clear();
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });
  
  test('should load user data successfully', async () => {
    // Mock successful API responses
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTubeConfigData)
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockProgressData)
      }));
    
    // Load user data
    const result = await loadUserData('test-user-id');
    
    // Validate API calls
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/user-stitches?prefetch=10', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      },
      credentials: 'include'
    });
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/user-progress', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      },
      credentials: 'include'
    });
    
    // Validate returned data
    expect(result).toEqual({
      tubeData: mockTubeConfigData,
      progressData: mockProgressData,
      dataTimestamp: expect.any(Number)
    });
    
    // Validate localStorage storage
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(3);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'zenjin_tube_data',
      JSON.stringify(mockTubeConfigData)
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'zenjin_user_progress',
      JSON.stringify(mockProgressData)
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'zenjin_data_timestamp',
      expect.any(String)
    );
  });
  
  test('should handle failure to load tube configuration', async () => {
    // Mock failed API response for tube config
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      }));
    
    // Attempt to load user data
    await expect(loadUserData('test-user-id')).rejects.toThrow('Failed to load tube configuration');
    
    // Should only call the first API endpoint
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    // Should log error
    expect(console.error).toHaveBeenCalled();
    
    // Should not store anything in localStorage
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
  
  test('should use default progress data when progress API fails', async () => {
    // Mock API responses - tube config successful, progress fails
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTubeConfigData)
      }))
      .mockImplementationOnce(() => Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'No progress found' })
      }));
    
    // Load user data
    const result = await loadUserData('test-user-id');
    
    // Validate both APIs were called
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    // Check default progress data was used
    expect(result.progressData).toEqual({
      totalPoints: 0,
      blinkSpeed: 0,
      evolution: {
        level: 1,
        name: 'Mind Spark',
        progress: 0
      }
    });
    
    // Should log warning
    expect(console.warn).toHaveBeenCalled();
    
    // Should still store in localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(3);
  });
  
  test('hasLocalUserData should detect when local data exists', () => {
    // Initially no data
    expect(hasLocalUserData()).toBe(false);
    
    // Add some data
    localStorageMock.setItem('zenjin_tube_data', JSON.stringify(mockTubeConfigData));
    localStorageMock.setItem('zenjin_user_progress', JSON.stringify(mockProgressData));
    
    // Mock the implementation for this specific test
    jest.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === 'zenjin_tube_data') return JSON.stringify(mockTubeConfigData);
      if (key === 'zenjin_user_progress') return JSON.stringify(mockProgressData);
      return null;
    });
    
    // Should now detect data
    expect(hasLocalUserData()).toBe(true);
    
    // Remove one item and update mock
    jest.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === 'zenjin_user_progress') return JSON.stringify(mockProgressData);
      return null;
    });
    
    // Should require both items
    expect(hasLocalUserData()).toBe(false);
  });
  
  test('getLocalUserData should retrieve cached user data', () => {
    // Set up mock data
    const timestamp = Date.now();
    
    // Mock localStorage for this specific test
    jest.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === 'zenjin_tube_data') return JSON.stringify(mockTubeConfigData);
      if (key === 'zenjin_user_progress') return JSON.stringify(mockProgressData);
      if (key === 'zenjin_data_timestamp') return timestamp.toString();
      return null;
    });
    
    // Get local data
    const result = getLocalUserData();
    
    // Validate result
    expect(result).toEqual({
      tubeData: mockTubeConfigData,
      progressData: mockProgressData,
      dataTimestamp: timestamp
    });
  });
  
  test('getLocalUserData should return null when no data exists', () => {
    // Reset the localStorage mock
    jest.spyOn(localStorage, 'getItem').mockImplementation(() => null);
    
    // No data in localStorage
    expect(getLocalUserData()).toBeNull();
    
    // Only partial data
    jest.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === 'zenjin_tube_data') return JSON.stringify(mockTubeConfigData);
      return null;
    });
    expect(getLocalUserData()).toBeNull();
  });
  
  test('getLocalUserData should handle invalid JSON data', () => {
    // Mock localStorage with invalid JSON data
    jest.spyOn(localStorage, 'getItem').mockImplementation(key => {
      if (key === 'zenjin_tube_data') return '{invalid-json';
      if (key === 'zenjin_user_progress') return JSON.stringify(mockProgressData);
      return null;
    });
    
    // Reset console.error mock
    (console.error as jest.Mock).mockClear();
    
    // Should return null and log error
    expect(getLocalUserData()).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
  
  test('clearUserData should remove all user data from localStorage', () => {
    // Reset removeItem mock to track calls
    (localStorage.removeItem as jest.Mock).mockClear();
    
    // Clear the data
    clearUserData();
    
    // Validate localStorage calls
    expect(localStorage.removeItem).toHaveBeenCalledTimes(3);
    expect(localStorage.removeItem).toHaveBeenCalledWith('zenjin_tube_data');
    expect(localStorage.removeItem).toHaveBeenCalledWith('zenjin_user_progress');
    expect(localStorage.removeItem).toHaveBeenCalledWith('zenjin_data_timestamp');
  });
});
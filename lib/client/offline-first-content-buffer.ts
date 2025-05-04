/**
 * Offline-First Content Buffer Manager
 * 
 * An enhanced version of the ContentBufferManager that prioritizes bundled content
 * and provides immediate access without waiting for network requests.
 * 
 * Key differences from standard content-buffer:
 * 1. Uses expanded-bundled-content with 10 stitches per tube
 * 2. Initializes synchronously with bundled content
 * 3. Only attempts API calls after initial content is available
 * 4. Provides identical content for anonymous and free users
 */

import { UserState } from '../state/types';
import { BUNDLED_FULL_CONTENT, DEFAULT_MANIFEST } from '../expanded-bundled-content';
import { isFeatureEnabled } from '../feature-flags';

// Types - keeping same interface as original content-buffer
export interface StitchReference {
  id: string;
  order: number;
  title?: string;
}

export interface ThreadManifest {
  title: string;
  stitches: StitchReference[];
}

export interface TubeManifest {
  threads: Record<string, ThreadManifest>;
}

export interface ContentManifest {
  version: number;
  generated: string;
  tubes: Record<string, TubeManifest>;
  stats: {
    tubeCount: number;
    threadCount: number;
    stitchCount: number;
  };
}

export interface ContentBufferUserState {
  userId: string;
  tubes: Record<string, {
    threadId: string;
    currentStitchId: string;
    stitches: Array<{
      id: string;
      threadId: string;
      position: number;
      skipNumber: number;
      distractorLevel: string;
    }>;
  }>;
  activeTubeNumber: number;
  lastUpdated: string;
}

export interface StitchContent {
  id: string;
  threadId: string;
  title: string;
  content: string;
  order: number;
  questions: any[];
}

// Buffer size - how many stitches to keep loaded per tube
const BUFFER_SIZE = 10;

/**
 * Offline-First Content Buffer Manager
 * 
 * Provides immediate access to content without waiting for network requests
 */
export class OfflineFirstContentBuffer {
  private manifest: ContentManifest = DEFAULT_MANIFEST;
  private cachedStitches: Record<string, StitchContent> = {};
  private isLoadingManifest = false;
  private isInitialized = true; // Start as initialized with bundled content
  private isAnonymousOrFreeUser = true; // Default assumption
  
  constructor() {
    // Initialize the cache with all bundled content immediately
    this.initializeBundledContent();
  }
  
  /**
   * Pre-load all bundled content into the cache for immediate access
   */
  private initializeBundledContent(): void {
    // Load all bundled stitches into the cache
    Object.entries(BUNDLED_FULL_CONTENT).forEach(([id, stitch]) => {
      this.cachedStitches[id] = stitch;
    });
    
    console.log(`Initialized offline-first content buffer with ${Object.keys(this.cachedStitches).length} bundled stitches`);
  }
  
  /**
   * Initialize the content buffer - mostly a no-op since we initialize in constructor
   * But keeps API compatibility with the original ContentBufferManager
   * 
   * @param isNewUser Optional flag to indicate this is a brand new user or anonymous user
   */
  async initialize(isNewUser: boolean = false, user: any = null): Promise<boolean> {
    // Check if user is anonymous or free tier
    this.isAnonymousOrFreeUser = !user || (user && !user.isPremium);
    
    // If already initialized with bundled content, we're good to go
    if (this.isInitialized) {
      // For authenticated premium users, try to load their personalized manifest
      // This happens in the background and doesn't block the UI
      if (user && user.isPremium) {
        this.loadManifestFromAPI().catch(error => {
          console.warn('Failed to load personalized manifest for premium user:', error);
        });
      }
      return true;
    }
    
    // Should never reach here since we pre-initialize, but keeping for API compatibility
    try {
      await this.loadManifest(isNewUser);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize content buffer:', error);
      return false;
    }
  }
  
  /**
   * Load the content manifest - prioritizes bundled content for anonymous and free users
   * @param isNewUser Optional flag to indicate this is a brand new user
   */
  async loadManifest(isNewUser: boolean = false): Promise<ContentManifest> {
    // For anonymous and free users, we always use the bundled manifest
    // and don't even try to load from API if feature flag is enabled
    if (this.isAnonymousOrFreeUser && isFeatureEnabled('useBundledContentForFreeUsers')) {
      this.manifest = DEFAULT_MANIFEST;
      console.log(`Using bundled manifest for anonymous/free user with ${this.manifest.stats.stitchCount} stitches`);
      return this.manifest;
    }
    
    // For premium users, try to load from API
    if (this.isLoadingManifest) {
      // Wait for existing load to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.manifest) return this.manifest;
    }
    
    try {
      return await this.loadManifestFromAPI();
    } catch (error) {
      console.error('Error in loadManifest:', error);
      throw error;
    }
  }
  
  /**
   * Load manifest from API - only for premium users
   * This is a separate method to handle API loading logic
   */
  private async loadManifestFromAPI(): Promise<ContentManifest> {
    this.isLoadingManifest = true;
    
    try {
      // Load manifest from API
      const response = await fetch('/api/content/manifest');
      
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success || !data.manifest) {
        throw new Error(data.error || 'Failed to load content manifest');
      }
      
      // Store the API manifest only for premium users
      if (!this.isAnonymousOrFreeUser) {
        this.manifest = data.manifest;
        console.log(`API manifest loaded with ${this.manifest.stats.stitchCount} stitches`);
      } else {
        console.log('Ignoring API manifest for anonymous/free user, keeping bundled content');
      }
      
      this.isLoadingManifest = false;
      return this.manifest;
    } catch (apiError) {
      this.isLoadingManifest = false;
      console.warn('Using bundled manifest due to API error:', apiError);
      return this.manifest; // Return the bundled manifest as fallback
    }
  }
  
  /**
   * Determine which stitches need to be loaded based on user state
   */
  getStitchesToBuffer(userState: UserState): string[] {
    // For anonymous and free users with the feature flag enabled,
    // we don't load additional stitches beyond the bundled ones
    if (this.isAnonymousOrFreeUser && isFeatureEnabled('useBundledContentForFreeUsers')) {
      return []; // All necessary content is already bundled
    }
    
    if (!this.manifest) {
      console.warn('Cannot determine stitches to buffer: manifest not loaded');
      return [];
    }
    
    const stitchesToLoad: string[] = [];
    
    // For premium users, implement the buffer logic
    Object.entries(userState.tubes).forEach(([tubeNumber, tubeState]) => {
      const currentStitchId = tubeState.currentStitchId;
      
      // Always include the current stitch ID if not in cache
      if (currentStitchId && !this.cachedStitches[currentStitchId]) {
        stitchesToLoad.push(currentStitchId);
      }
      
      // For premium users, get upcoming stitches from the manifest
      const upcomingStitches = this.getUpcomingStitchesFromManifest(
        parseInt(tubeNumber, 10), 
        tubeState.threadId, 
        currentStitchId
      );
      
      // Add any uncached stitches to the loading list
      upcomingStitches.forEach(stitchId => {
        if (!this.cachedStitches[stitchId] && !stitchesToLoad.includes(stitchId)) {
          stitchesToLoad.push(stitchId);
        }
      });
    });
    
    return stitchesToLoad;
  }
  
  /**
   * Get the upcoming stitches for a specific tube based on manifest order
   */
  getUpcomingStitchesFromManifest(tubeNumber: number, threadId: string, currentStitchId: string): string[] {
    if (!this.manifest) return [];
    
    // Get the tube manifest
    const tubeManifest = this.manifest.tubes[tubeNumber];
    if (!tubeManifest) return [];
    
    // Get the thread manifest
    const threadManifest = tubeManifest.threads[threadId];
    if (!threadManifest) return [];
    
    // Find the current stitch in the ordered list
    const stitches = threadManifest.stitches;
    const currentIndex = stitches.findIndex(s => s.id === currentStitchId);
    
    if (currentIndex === -1) return [];
    
    // Get the next BUFFER_SIZE stitches after the current one
    return stitches
      .slice(currentIndex + 1, currentIndex + 1 + BUFFER_SIZE)
      .map(s => s.id);
  }
  
  /**
   * Get the upcoming stitches for a specific tube based on position-based state
   * For compatibility with the position-based model when it's available
   */
  getUpcomingStitches(userState: ContentBufferUserState, tubeNumber: number): string[] {
    const tubeState = userState.tubes[tubeNumber];
    if (!tubeState) return [];
    
    // Get stitches sorted by position (lowest first)
    const sortedStitches = [...tubeState.stitches]
      .sort((a, b) => a.position - b.position);
    
    // Find the current position (should be 0)
    const currentIndex = sortedStitches.findIndex(s => s.id === tubeState.currentStitchId);
    
    if (currentIndex === -1) return [];
    
    // Get the next BUFFER_SIZE stitches after the current one
    return sortedStitches
      .slice(currentIndex + 1, currentIndex + 1 + BUFFER_SIZE)
      .map(s => s.id);
  }
  
  /**
   * Fetch a batch of stitches from the server
   * Only used for premium users, anonymous/free users use bundled content
   */
  async fetchStitches(stitchIds: string[]): Promise<StitchContent[]> {
    // For anonymous and free users with the feature flag enabled,
    // we don't fetch from the server
    if (this.isAnonymousOrFreeUser && isFeatureEnabled('useBundledContentForFreeUsers')) {
      // Filter only the IDs that are in our bundled content
      const bundledStitches = stitchIds
        .filter(id => BUNDLED_FULL_CONTENT[id])
        .map(id => BUNDLED_FULL_CONTENT[id]);
      
      return bundledStitches;
    }
    
    if (stitchIds.length === 0) return [];
    
    try {
      const response = await fetch('/api/content/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stitchIds })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stitches: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch stitches');
      }
      
      return data.stitches || [];
    } catch (error) {
      console.error('Error fetching stitches:', error);
      
      // Fallback to bundled content for any matching IDs
      const fallbackStitches = stitchIds
        .filter(id => BUNDLED_FULL_CONTENT[id])
        .map(id => BUNDLED_FULL_CONTENT[id]);
      
      if (fallbackStitches.length > 0) {
        console.log(`Using ${fallbackStitches.length} bundled stitches as fallback`);
        return fallbackStitches;
      }
      
      throw error;
    }
  }
  
  /**
   * Update the buffer based on current user state
   * For premium users only - free/anon users use bundled content
   */
  async updateBuffer(userState: UserState): Promise<void> {
    // For anonymous and free users with the feature flag enabled,
    // we don't update the buffer from the server
    if (this.isAnonymousOrFreeUser && isFeatureEnabled('useBundledContentForFreeUsers')) {
      return;
    }
    
    // Make sure we have the manifest
    if (!this.manifest) {
      await this.loadManifest();
    }
    
    // Determine which stitches need to be loaded
    const stitchesToLoad = this.getStitchesToBuffer(userState);
    
    if (stitchesToLoad.length === 0) {
      console.log('Buffer is up to date, no new stitches to load');
      return;
    }
    
    console.log(`Loading ${stitchesToLoad.length} stitches to update buffer`);
    
    // Fetch the needed stitches
    try {
      const fetchedStitches = await this.fetchStitches(stitchesToLoad);
      
      // Add them to the cache
      fetchedStitches.forEach(stitch => {
        this.cachedStitches[stitch.id] = stitch;
      });
      
      console.log(`Updated buffer with ${fetchedStitches.length} new stitches`);
    } catch (error) {
      console.error('Failed to update buffer:', error);
    }
  }
  
  /**
   * Get a stitch from the cache or bundled content, prioritizing immediate availability
   * This is the key method that makes the system work offline-first
   */
  async getStitch(stitchId: string): Promise<StitchContent | null> {
    // 1. Return from cache if available (fastest)
    if (this.cachedStitches[stitchId]) {
      return this.cachedStitches[stitchId];
    }
    
    // 2. Use expanded bundled content directly since it now has complete stitch data
    if (BUNDLED_FULL_CONTENT[stitchId]) {
      // Cache the bundled content
      this.cachedStitches[stitchId] = BUNDLED_FULL_CONTENT[stitchId];
      console.log(`Using ${BUNDLED_FULL_CONTENT[stitchId].questions?.length || 0} questions from bundled content for stitch ${stitchId}`);
      return BUNDLED_FULL_CONTENT[stitchId];
    }
    
    // 3. For premium users only, try to load from API
    if (!this.isAnonymousOrFreeUser) {
      try {
        const [stitch] = await this.fetchStitches([stitchId]);
        
        if (stitch) {
          // For API-loaded stitches, check if they have enough questions
          if (stitch.questions && stitch.questions.length >= 10) {
            this.cachedStitches[stitchId] = stitch;
            return stitch;
          } else {
            // Even API stitches might need enhancement
            console.log(`API-loaded stitch ${stitchId} has only ${stitch.questions?.length || 0} questions. Enhancing.`);
            // Store in bundled content for enhancement
            BUNDLED_FULL_CONTENT[stitchId] = stitch;
            return this.generateFallbackStitch(stitchId);
          }
        }
      } catch (error) {
        console.error(`Failed to get stitch ${stitchId} from API:`, error);
      }
    }
    
    // 4. Generate a fallback stitch as last resort
    return this.generateFallbackStitch(stitchId);
  }
  
  /**
   * Generate a fallback stitch when all other methods fail
   * Includes enhanced question generation to provide a full set of questions
   */
  private generateFallbackStitch(stitchId: string): StitchContent | null {
    // Determines how many questions to generate for each stitch
    const QUESTIONS_PER_STITCH = 20;
    
    // Check if this is a Tube 2 stitch (Basic Operations - Addition/Subtraction)
    if (stitchId.startsWith('stitch-T2-')) {
      console.log(`Enhancing Tube 2 stitch ${stitchId} with additional questions`);
      
      // Get original stitch from bundled content
      const originalStitch = BUNDLED_FULL_CONTENT[stitchId];
      if (!originalStitch) {
        console.warn(`No original stitch found for ${stitchId}`);
        return this.generateGenericFallbackStitch(stitchId);
      }
      
      // Generate additional basic addition/subtraction questions
      const enhancedQuestions = [];
      
      // Keep any existing questions
      if (originalStitch.questions && originalStitch.questions.length > 0) {
        enhancedQuestions.push(...originalStitch.questions);
      }
      
      // Generate more questions if needed
      while (enhancedQuestions.length < QUESTIONS_PER_STITCH) {
        const a = Math.floor(Math.random() * 10);
        const b = Math.floor(Math.random() * 10);
        const sum = a + b;
        const diff = Math.max(a, b) - Math.min(a, b);
        
        // Decide between addition and subtraction based on stitch ID
        const isAddition = stitchId.includes('-001-01') || stitchId.includes('-001-02');
        
        if (isAddition) {
          enhancedQuestions.push({
            id: `${stitchId}-q${(enhancedQuestions.length + 1).toString().padStart(2, '0')}`,
            text: `What is ${a} + ${b}?`,
            correctAnswer: `${sum}`,
            distractors: {
              L1: `${sum + 1}`,
              L2: `${sum - 1}`,
              L3: `${a}${b}` // Common mistake of concatenating digits
            }
          });
        } else {
          // Use larger number first to avoid negative results
          const larger = Math.max(a, b);
          const smaller = Math.min(a, b);
          
          enhancedQuestions.push({
            id: `${stitchId}-q${(enhancedQuestions.length + 1).toString().padStart(2, '0')}`,
            text: `What is ${larger} - ${smaller}?`,
            correctAnswer: `${larger - smaller}`,
            distractors: {
              L1: `${larger - smaller + 1}`,
              L2: `${larger - smaller - 1}`,
              L3: `${smaller - larger}` // Common mistake of reversing operands
            }
          });
        }
      }
      
      // Create enhanced stitch with additional questions
      const enhancedStitch: StitchContent = {
        ...originalStitch,
        questions: enhancedQuestions.slice(0, QUESTIONS_PER_STITCH) // Limit to desired count
      };
      
      this.cachedStitches[stitchId] = enhancedStitch;
      console.log(`Enhanced stitch ${stitchId} with ${enhancedStitch.questions.length} questions`);
      return enhancedStitch;
    }
    
    // Check if this is a Tube 3 stitch (Problem Solving)
    if (stitchId.startsWith('stitch-T3-')) {
      console.log(`Enhancing Tube 3 stitch ${stitchId} with additional questions`);
      
      // Get original stitch from bundled content
      const originalStitch = BUNDLED_FULL_CONTENT[stitchId];
      if (!originalStitch) {
        console.warn(`No original stitch found for ${stitchId}`);
        return this.generateGenericFallbackStitch(stitchId);
      }
      
      // Generate word problems
      const enhancedQuestions = [];
      
      // Keep any existing questions
      if (originalStitch.questions && originalStitch.questions.length > 0) {
        enhancedQuestions.push(...originalStitch.questions);
      }
      
      // Word problem templates
      const wordProblemTemplates = [
        {
          text: (a, b) => `Sarah has ${a} apples. Tom gives her ${b} more apples. How many apples does Sarah have now?`,
          answer: (a, b) => a + b,
          distractors: (a, b) => ({ L1: a + b - 1, L2: a + b + 1, L3: a - b })
        },
        {
          text: (a, b) => `Jack has ${a} stickers. Jill has ${b} stickers. How many stickers do they have together?`,
          answer: (a, b) => a + b,
          distractors: (a, b) => ({ L1: a + b - 1, L2: a + b + 1, L3: a - b })
        },
        {
          text: (a, b) => `There are ${a} children on the bus. At the bus stop, ${b} children get off. How many children are left on the bus?`,
          answer: (a, b) => a - b,
          distractors: (a, b) => ({ L1: a - b + 1, L2: a - b - 1, L3: a + b })
        },
        {
          text: (a, b) => `Max has ${a} toy cars. He gives ${b} cars to his friend. How many cars does Max have left?`,
          answer: (a, b) => a - b,
          distractors: (a, b) => ({ L1: a - b + 1, L2: a - b - 1, L3: a + b })
        }
      ];
      
      // Generate more questions if needed
      while (enhancedQuestions.length < QUESTIONS_PER_STITCH) {
        const a = 5 + Math.floor(Math.random() * 10); // Larger first number
        const b = 1 + Math.floor(Math.random() * 5);  // Smaller second number
        
        // Select random template
        const template = wordProblemTemplates[Math.floor(Math.random() * wordProblemTemplates.length)];
        
        // For subtraction problems, ensure a > b to avoid negative results
        const problemA = template.text.toString().includes('left') ? Math.max(a, b + 2) : a;
        const problemB = template.text.toString().includes('left') ? Math.min(b, problemA - 2) : b;
        
        enhancedQuestions.push({
          id: `${stitchId}-q${(enhancedQuestions.length + 1).toString().padStart(2, '0')}`,
          text: template.text(problemA, problemB),
          correctAnswer: `${template.answer(problemA, problemB)}`,
          distractors: {
            L1: `${template.distractors(problemA, problemB).L1}`,
            L2: `${template.distractors(problemA, problemB).L2}`,
            L3: `${template.distractors(problemA, problemB).L3}`
          }
        });
      }
      
      // Create enhanced stitch with additional questions
      const enhancedStitch: StitchContent = {
        ...originalStitch,
        questions: enhancedQuestions.slice(0, QUESTIONS_PER_STITCH) // Limit to desired count
      };
      
      this.cachedStitches[stitchId] = enhancedStitch;
      console.log(`Enhanced stitch ${stitchId} with ${enhancedStitch.questions.length} questions`);
      return enhancedStitch;
    }
    
    // Check if this is a Tube 1 stitch (Number Facts) or any other stitch
    // Get original stitch from bundled content
    const originalStitch = BUNDLED_FULL_CONTENT[stitchId];
    if (originalStitch) {
      console.log(`Enhancing stitch ${stitchId} with additional questions`);
      
      // Generate number fact questions
      const enhancedQuestions = [];
      
      // Keep any existing questions
      if (originalStitch.questions && originalStitch.questions.length > 0) {
        enhancedQuestions.push(...originalStitch.questions);
      }
      
      // Number facts operations based on stitch ID
      const isCounting = stitchId.includes('-001-01') || stitchId.includes('-001-02');
      const isComparison = stitchId.includes('-001-03') || stitchId.includes('-001-04');
      const isSequence = stitchId.includes('-001-05') || stitchId.includes('-001-06');
      
      // Generate more questions if needed
      while (enhancedQuestions.length < QUESTIONS_PER_STITCH) {
        if (isCounting) {
          // Counting questions
          const num = 1 + Math.floor(Math.random() * 9);
          enhancedQuestions.push({
            id: `${stitchId}-q${(enhancedQuestions.length + 1).toString().padStart(2, '0')}`,
            text: `What comes after ${num}?`,
            correctAnswer: `${num + 1}`,
            distractors: {
              L1: `${num + 2}`,
              L2: `${num - 1}`,
              L3: `${num}`
            }
          });
        } else if (isComparison) {
          // Comparison questions
          const a = 1 + Math.floor(Math.random() * 10);
          const b = 1 + Math.floor(Math.random() * 10);
          const greater = Math.max(a, b);
          const lesser = Math.min(a, b);
          
          enhancedQuestions.push({
            id: `${stitchId}-q${(enhancedQuestions.length + 1).toString().padStart(2, '0')}`,
            text: `Which number is greater: ${a} or ${b}?`,
            correctAnswer: `${greater}`,
            distractors: {
              L1: `${lesser}`,
              L2: `They are equal`,
              L3: `Can't determine`
            }
          });
        } else if (isSequence) {
          // Sequence questions
          const start = 1 + Math.floor(Math.random() * 5);
          const step = 1 + Math.floor(Math.random() * 3);
          
          enhancedQuestions.push({
            id: `${stitchId}-q${(enhancedQuestions.length + 1).toString().padStart(2, '0')}`,
            text: `What comes next in the sequence: ${start}, ${start + step}, ${start + 2*step}?`,
            correctAnswer: `${start + 3*step}`,
            distractors: {
              L1: `${start + 3*step + 1}`,
              L2: `${start + 3*step - 1}`,
              L3: `${start + 4*step}`
            }
          });
        } else {
          // Default number questions for any other stitch
          const a = Math.floor(Math.random() * 10);
          const b = Math.floor(Math.random() * 10);
          
          enhancedQuestions.push({
            id: `${stitchId}-q${(enhancedQuestions.length + 1).toString().padStart(2, '0')}`,
            text: `What is ${a} + ${b}?`,
            correctAnswer: `${a + b}`,
            distractors: {
              L1: `${a + b + 1}`,
              L2: `${a + b - 1}`,
              L3: `${a * b}`
            }
          });
        }
      }
      
      // Create enhanced stitch with additional questions
      const enhancedStitch: StitchContent = {
        ...originalStitch,
        questions: enhancedQuestions.slice(0, QUESTIONS_PER_STITCH) // Limit to desired count
      };
      
      this.cachedStitches[stitchId] = enhancedStitch;
      console.log(`Enhanced stitch ${stitchId} with ${enhancedStitch.questions.length} questions`);
      return enhancedStitch;
    }
    
    // If we don't have the original stitch, create a generic fallback
    return this.generateGenericFallbackStitch(stitchId);
  }
  
  /**
   * Generate a generic fallback stitch when no bundled content is available
   * This is a last resort option
   */
  private generateGenericFallbackStitch(stitchId: string): StitchContent | null {
    // Check if this is a first stitch of a tube (pattern: stitch-T{n}-001-01)
    const tubeMatch = stitchId.match(/stitch-T(\d+)-001-01/);
    if (tubeMatch) {
      const tubeNumber = tubeMatch[1];
      console.warn(`Using generated content for first stitch of tube ${tubeNumber}`);
      
      // Generate a stitch with multiple questions
      const questions = [];
      for (let i = 1; i <= 20; i++) {
        questions.push({
          id: `${stitchId}-q${i.toString().padStart(2, '0')}`,
          text: `What is ${i} + ${i}?`,
          correctAnswer: `${i+i}`,
          distractors: { 
            L1: `${i+i+1}`, 
            L2: `${i+i-1}`, 
            L3: `${i*i}` 
          }
        });
      }
      
      // Generate a simple stitch with minimal content
      const emergencyStitch: StitchContent = {
        id: stitchId,
        threadId: `thread-T${tubeNumber}-001`,
        title: `Basic Content for Tube ${tubeNumber}`,
        content: `Basic content for learning tube ${tubeNumber}`,
        order: 1,
        questions: questions
      };
      
      this.cachedStitches[stitchId] = emergencyStitch;
      return emergencyStitch;
    }
    
    // Last resort fallback for non-first stitches
    if (stitchId.includes('-001-')) {
      console.warn(`Using fallback content for ${stitchId}`);
      
      // Extract thread and tube info from the ID
      const threadMatch = stitchId.match(/stitch-T(\d+)-(\d+)/);
      const tubeNumber = threadMatch ? threadMatch[1] : '1';
      const threadNumber = threadMatch ? threadMatch[2] : '001';
      
      // Generate multiple questions
      const questions = [];
      for (let i = 1; i <= 20; i++) {
        const a = Math.floor(Math.random() * 10);
        const b = Math.floor(Math.random() * 10);
        
        questions.push({
          id: `${stitchId}-fallback-q${i.toString().padStart(2, '0')}`,
          text: `What is ${a} + ${b}?`,
          correctAnswer: `${a + b}`,
          distractors: { 
            L1: `${a + b + 1}`, 
            L2: `${a + b - 1}`, 
            L3: `${a * b}` 
          }
        });
      }
      
      // Create a fallback stitch with multiple questions
      const fallbackStitch: StitchContent = {
        id: stitchId,
        threadId: `thread-T${tubeNumber}-${threadNumber}`,
        title: 'Offline Content',
        content: 'This content is available offline.',
        order: parseInt(stitchId.split('-').pop() || '1', 10),
        questions: questions
      };
      
      this.cachedStitches[stitchId] = fallbackStitch;
      return fallbackStitch;
    }
    
    return null;
  }
  
  /**
   * Get the in-play stitch (the active stitch of the active tube)
   */
  async getInPlayStitch(userState: UserState): Promise<StitchContent | null> {
    // For standard state, the active tube is activeTube
    const activeTubeNumber = userState.activeTube || userState.activeTubeNumber;
    const activeTube = userState.tubes[activeTubeNumber];
    
    if (!activeTube) {
      console.error(`Active tube ${activeTubeNumber} not found in user state`);
      return null;
    }
    
    return this.getStitch(activeTube.currentStitchId);
  }
  
  /**
   * Set whether the current user is anonymous/free or premium
   * This affects content buffering behavior
   * 
   * @param isAnonymousOrFree Whether user is anonymous or free tier
   */
  setUserTier(isAnonymousOrFree: boolean): void {
    this.isAnonymousOrFreeUser = isAnonymousOrFree;
    console.log(`User tier set to ${isAnonymousOrFree ? 'anonymous/free' : 'premium'}`);
  }
  
  /**
   * Clear the stitch cache
   */
  clearCache(): void {
    // Re-initialize with just the bundled content
    this.cachedStitches = {};
    this.initializeBundledContent();
    console.log('Content buffer cache cleared and re-initialized with bundled content');
  }
  
  /**
   * Get the count of cached stitches (for diagnostic purposes)
   */
  getCachedStitchCount(): number {
    return Object.keys(this.cachedStitches).length;
  }
}

// Create a singleton instance
export const offlineFirstContentBuffer = new OfflineFirstContentBuffer();
/**
 * preloader.js - Utilities for content preloading
 * 
 * Provides utilities for optimized content preloading to ensure
 * smooth transitions between stitches. Focuses on:
 * - Prioritizing next content
 * - Managing concurrent requests
 * - Handling images and audio assets
 */

/**
 * Preload a collection of assets by type
 * @param {Array} assets - Array of asset objects with URLs
 * @param {string} type - Asset type ('image', 'audio', 'json')
 * @param {number} concurrency - Maximum concurrent requests
 * @returns {Promise<Array>} Results of preloading
 */
async function preloadAssets(assets, type = 'image', concurrency = 3) {
  if (!assets || assets.length === 0) {
    return [];
  }
  
  // Create a work queue
  const queue = [...assets];
  const results = [];
  
  // Function to process a single item
  const processItem = async (asset) => {
    try {
      const result = await preloadAsset(asset, type);
      return {
        success: true,
        asset,
        result
      };
    } catch (error) {
      return {
        success: false,
        asset,
        error: error.message
      };
    }
  };
  
  // Process in batches for concurrency control
  while (queue.length > 0) {
    // Take a batch from the queue
    const batch = queue.splice(0, concurrency);
    
    // Process the batch concurrently
    const batchResults = await Promise.allSettled(
      batch.map(asset => processItem(asset))
    );
    
    // Collect results
    results.push(...batchResults.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason.message
        };
      }
    }));
  }
  
  return results;
}

/**
 * Preload a single asset
 * @param {Object|string} asset - Asset object or URL
 * @param {string} type - Asset type
 * @returns {Promise} Preloaded asset
 */
function preloadAsset(asset, type = 'image') {
  const url = typeof asset === 'string' ? asset : asset.url;
  
  if (!url) {
    return Promise.reject(new Error('No URL provided for asset'));
  }
  
  switch (type.toLowerCase()) {
    case 'image':
      return preloadImage(url);
    case 'audio':
      return preloadAudio(url);
    case 'json':
      return preloadJson(url);
    default:
      return Promise.reject(new Error(`Unknown asset type: ${type}`));
  }
}

/**
 * Preload an image
 * @param {string} url - Image URL
 * @returns {Promise<HTMLImageElement>} Loaded image
 */
function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    
    img.src = url;
  });
}

/**
 * Preload an audio file
 * @param {string} url - Audio URL
 * @returns {Promise<HTMLAudioElement>} Loaded audio
 */
function preloadAudio(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = () => reject(new Error(`Failed to load audio: ${url}`));
    
    audio.src = url;
    audio.load();
  });
}

/**
 * Preload a JSON file
 * @param {string} url - JSON URL
 * @returns {Promise<Object>} Parsed JSON
 */
async function preloadJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to load JSON: ${url} - ${error.message}`);
  }
}

/**
 * Preload assets for a stitch
 * @param {Object} stitch - Stitch object
 * @returns {Promise<Object>} Results of preloading
 */
async function preloadStitchAssets(stitch) {
  if (!stitch || !stitch.id) {
    return { success: false, error: 'Invalid stitch object' };
  }
  
  const results = {
    stitch: stitch.id,
    images: [],
    audio: [],
    success: true
  };
  
  try {
    // Extract assets from stitch
    const imageAssets = extractImageAssets(stitch);
    const audioAssets = extractAudioAssets(stitch);
    
    // Preload images
    if (imageAssets.length > 0) {
      results.images = await preloadAssets(imageAssets, 'image');
    }
    
    // Preload audio
    if (audioAssets.length > 0) {
      results.audio = await preloadAssets(audioAssets, 'audio');
    }
    
    return results;
  } catch (error) {
    results.success = false;
    results.error = error.message;
    return results;
  }
}

/**
 * Extract image assets from a stitch
 * @param {Object} stitch - Stitch object
 * @returns {Array} Image assets
 */
function extractImageAssets(stitch) {
  const images = [];
  
  // Extract from content (placeholder implementation)
  // In a real app, this would scan for image URLs in stitch content
  
  return images;
}

/**
 * Extract audio assets from a stitch
 * @param {Object} stitch - Stitch object
 * @returns {Array} Audio assets
 */
function extractAudioAssets(stitch) {
  const audio = [];
  
  // Extract from content (placeholder implementation)
  // In a real app, this would scan for audio URLs in stitch content
  
  return audio;
}

module.exports = {
  preloadAssets,
  preloadAsset,
  preloadImage,
  preloadAudio,
  preloadJson,
  preloadStitchAssets
};
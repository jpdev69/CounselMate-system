// backend/utils/responseCache.js
// Simple in-memory cache for chatbot responses

class ResponseCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  // Generate cache key from query
  generateKey(query) {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // Get cached response
  get(query) {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);
    
    if (entry && Date.now() - entry.timestamp < 300000) { // 5 minutes TTL
      // Move to end (LRU)
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.response;
    }
    
    return null;
  }

  // Cache response
  set(query, response) {
    const key = this.generateKey(query);
    
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });
  }

  // Clear cache
  clear() {
    this.cache.clear();
  }

  // Get stats
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

module.exports = new ResponseCache();

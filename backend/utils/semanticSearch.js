// backend/utils/semanticSearch.js
// Simple keyword-based RAG implementation for the student manual

class ManualSearcher {
  constructor() {
    this.chunks = [];
    this.indexed = false;
  }

  // Split manual into searchable chunks
  indexManual(manualText) {
    this.chunks = [];
    const lines = manualText.split('\n');
    
    // Create chunks of ~15 lines each with overlap for better context
    const CHUNK_SIZE = 15;
    const OVERLAP = 3;
    
    for (let i = 0; i < lines.length; i += CHUNK_SIZE - OVERLAP) {
      const chunk = {
        startLine: i + 1,
        endLine: Math.min(i + CHUNK_SIZE, lines.length),
        text: lines.slice(i, i + CHUNK_SIZE).join('\n'),
        keywords: this.extractKeywords(lines.slice(i, i + CHUNK_SIZE).join(' '))
      };
      this.chunks.push(chunk);
    }
    
    this.indexed = true;
    console.log(`✅ Indexed manual into ${this.chunks.length} chunks`);
  }

  // Extract keywords from text
  extractKeywords(text) {
    const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','can','this','that','these','those','i','you','he','she','it','we','they','what','which','who','when','where','why','how']);
    
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  // Search for relevant chunks
  search(query, maxResults = 10) {
    if (!this.indexed) return [];
    
    const queryWords = this.extractKeywords(query);
    const scored = this.chunks.map(chunk => {
      const score = queryWords.reduce((acc, word) => {
        return acc + chunk.keywords.filter(kw => kw.includes(word) || word.includes(kw)).length;
      }, 0);
      return { ...chunk, score };
    });
    
    return scored
      .filter(chunk => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  // Get comprehensive context based on query type
  getContext(query) {
    const relevantChunks = this.search(query);
    
    // If no relevant chunks found, return full manual for comprehensive questions
    if (relevantChunks.length === 0) {
      const comprehensiveKeywords = ['comprehensive', 'all', 'complete', 'summary', 'overview', 'everything', 'violation', 'violations', 'rules', 'regulations'];
      const isComprehensive = comprehensiveKeywords.some(keyword => 
        query.toLowerCase().includes(keyword)
      );
      
      if (isComprehensive) {
        return 'FULL_MANUAL'; // Signal to use full manual
      }
      return '';
    }
    
    // For queries with many matches, return more context
    const contextSize = relevantChunks.length >= 5 ? 10 : 8;
    const topChunks = relevantChunks.slice(0, contextSize);
    
    // If we have many relevant chunks, it might be a comprehensive question
    if (relevantChunks.length >= 8) {
      return 'FULL_MANUAL';
    }
    
    return topChunks.map(chunk => 
      `[Lines ${chunk.startLine}-${chunk.endLine}]\n${chunk.text}`
    ).join('\n\n');
  }

  // Get section-based context for better comprehensive answers
  getSectionContext(query, sectionKeywords = ['chapter', 'section', 'article']) {
    const relevantChunks = this.search(query, 15);
    
    // Group chunks by proximity to create section-level context
    const sections = [];
    let currentSection = [];
    
    for (const chunk of relevantChunks) {
      if (currentSection.length === 0) {
        currentSection.push(chunk);
      } else {
        const lastChunk = currentSection[currentSection.length - 1];
        // If chunks are close in line numbers, add to current section
        if (chunk.startLine - lastChunk.endLine <= 20) {
          currentSection.push(chunk);
        } else {
          // Start new section
          sections.push([...currentSection]);
          currentSection = [chunk];
        }
      }
    }
    
    if (currentSection.length > 0) {
      sections.push(currentSection);
    }
    
    // Return the largest section as context
    const largestSection = sections.reduce((largest, section) => 
      section.length > largest.length ? section : largest, []
    );
    
    if (largestSection.length >= 5) {
      return 'FULL_MANUAL'; // Large section suggests comprehensive question
    }
    
    return largestSection.map(chunk => 
      `[Lines ${chunk.startLine}-${chunk.endLine}]\n${chunk.text}`
    ).join('\n\n');
  }
}

module.exports = new ManualSearcher();

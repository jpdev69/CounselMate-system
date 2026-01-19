const http = require('http');

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'dolphin3';

/**
 * Makes a request to the local Ollama API
 * @param {string} endpoint - The API endpoint
 * @param {object} data - The request body
 * @returns {Promise<string>} - The response text
 */
async function callOllama(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, OLLAMA_BASE_URL);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(body);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Checks if Ollama is running and accessible
 * @returns {Promise<boolean>}
 */
async function isOllamaAvailable() {
  try {
    const response = await callOllama('/api/tags', {});
    return response.includes('models') || response.length > 0;
  } catch (error) {
    console.error('❌ Ollama is not available:', error.message);
    return false;
  }
}

/**
 * Validates if violation description matches the violation type
 * Uses local Ollama LLM to perform semantic matching
 * @param {string} violationType - The type/code of the violation (e.g., "TARDINESS")
 * @param {string} description - The detailed violation description
 * @returns {Promise<{matches: boolean, confidence: number, reason: string}>}
 */
async function validateViolationMatch(violationType, description) {
  if (!violationType || !description) {
    return {
      matches: false,
      confidence: 0,
      reason: 'Missing violation type or description',
    };
  }

  try {
    const available = await isOllamaAvailable();
    if (!available) {
      console.warn(
        '⚠️  Ollama is not available. Using fallback validation. Please start Ollama with: ollama serve'
      );
      return performFallbackValidation(violationType, description);
    }

    // LLM-only: explicit about confirming violation occurred, handles negation
    const strictPrompt = `Does this description CONFIRM the student committed this violation?
Violation: ${violationType}
Description: ${description}

Rules:
- If description says NOT, didn't, never, or denies violation: MISMATCH
- If description is vague: MISMATCH
- Only if description clearly confirms the violation occurred: MATCH

Respond ONE WORD: MATCH or MISMATCH`;

    const response = await callOllama('/api/generate', {
      model: OLLAMA_MODEL,
      prompt: strictPrompt,
      stream: false,
      temperature: 0.1,
      options: {
        num_predict: 3, // force single word response
      }
    });

    // Parse the response
    let result;
    try {
      result = JSON.parse(response);
    } catch (e) {
      console.warn('Failed to parse LLM response as JSON, attempting text extraction');
      result = { response: response };
    }

    const responseText = (result.response || response).trim().toUpperCase().split(/\s+/)[0];
    console.log('🤖 LLM Response:', responseText);

    if (responseText === 'MATCH') {
      return {
        matches: true,
        confidence: 0.9,
        reason: `LLM validated that the description matches violation type "${violationType}"`,
      };
    }

    // Default to mismatch for anything else (MISMATCH, UNCLEAR, or junk output)
    return {
      matches: false,
      confidence: 0.95,
      reason: `The violation description does not clearly match the violation type "${violationType}"`,
    };
  } catch (error) {
    console.error('❌ Error validating violation match:', error.message);
    // Fallback to simple validation if LLM fails
    return performFallbackValidation(violationType, description);
  }
}

/**
 * Fallback validation when LLM is not available
 * Performs basic keyword matching
 * @param {string} violationType
 * @param {string} description
 * @returns {object}
 */
function performFallbackValidation(violationType, description) {
  const typeUpper = violationType.toUpperCase();
  const typeKey = typeUpper.replace(/[_\s-]/g, ''); // normalize e.g., DRESS_CODE -> DRESSCODE
  const descUpper = description.toUpperCase();

  // Define violation type categories and related keywords
  const violationKeywords = {
    TARDINESS: ['LATE', 'TARDY', 'ARRIVE', 'ABSENT', 'NOT ON TIME'],
    TRUANCY: ['SKIP', 'ABSENT', 'BUNKED', 'DID NOT ATTEND'],
    DISRESPECT: ['RUDE', 'DISRESPECT', 'TALK BACK', 'INSOLENT', 'INSUBORDINATE'],
    BULLYING: ['BULLY', 'HARASS', 'THREATEN', 'INTIMIDATE', 'TEASE'],
    CHEATING: ['CHEAT', 'COPIED', 'PLAGIARISM', 'COPIED WORK', 'ACADEMIC DISHONESTY'],
    FIGHTING: ['FIGHT', 'PHYSICAL', 'HIT', 'PUNCH', 'ASSAULT', 'ALTERCATION'],
    VANDALISM: ['DAMAGE', 'DEFACE', 'VANDAL', 'DESTROY', 'BREAK'],
    DRESSCODE: [
      'UNIFORM', 'DRESS CODE', 'IMPROPER UNIFORM', 'NO UNIFORM', 'NOT WEARING UNIFORM',
      'WITHOUT UNIFORM', 'OUT OF UNIFORM', 'ATTIRE', 'APPEARANCE', 'GROOMING', 'DRESS', 'WEARING JEANS',
      'CIVILIAN CLOTHES', 'WRONG UNIFORM', 'NO ID', 'MISSING ID'
    ],
  };

  // Check if type name appears in description
  if (descUpper.includes(typeUpper)) {
    return {
      matches: true,
      confidence: 0.85,
      reason: `Description mentions the violation type`,
    };
  }

  // Check for related keywords
  const keywords = violationKeywords[typeUpper] || violationKeywords[typeKey] || [];
  const matchedKeywords = keywords.filter((kw) => descUpper.includes(kw.toUpperCase()));

  if (matchedKeywords.length > 0) {
    return {
      matches: true,
      confidence: 0.75,
      reason: `Description contains keywords related to ${violationType}`,
    };
  }

  // No match found
  return {
    matches: false,
    confidence: 0.8,
    reason: `No clear connection found between description and ${violationType} violation type`,
  };
}

module.exports = {
  validateViolationMatch,
  isOllamaAvailable,
};

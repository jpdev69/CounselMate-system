// backend/utils/llmService.js
// Centralized Ollama LLM service for all AI features

const http = require('http');

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';

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
 * Checks if Ollama is running and accessible (GET /api/tags)
 * @returns {Promise<boolean>}
 */
function isOllamaAvailable() {
  return new Promise((resolve) => {
    const url = new URL('/api/tags', OLLAMA_BASE_URL);
    http.get(url.toString(), (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(res.statusCode === 200));
    }).on('error', (error) => {
      console.error('❌ Ollama is not available. Please start Ollama server with: ollama serve', error.message);
      resolve(false);
    });
  });
}

/**
 * Chat completion using Ollama
 * @param {Array} messages - Array of message objects with role and content
 * @param {object} options - Additional options for the model
 * @returns {Promise<string>} - The response content
 */
async function chatCompletion(messages, options = {}) {
  const defaultOptions = {
    model: OLLAMA_MODEL,
    stream: false,
    temperature: 0.1,
    options: {
      num_predict: 8192, // Default - overridden by feature-specific settings
      ...options
    }
  };

  const response = await callOllama('/api/chat', {
    model: defaultOptions.model,
    messages,
    stream: defaultOptions.stream,
    temperature: defaultOptions.temperature,
    options: defaultOptions.options
  });

  const parsed = JSON.parse(response);
  let content = parsed?.message?.content || '';

  // Clean up any special tokens
  content = content.replace(/<[^>]+>/g, '').trim();

  return content;
}

/**
 * Text completion using Ollama (for generation tasks)
 * @param {string} prompt - The prompt text
 * @param {object} options - Additional options
 * @returns {Promise<string>} - The generated text
 */
async function textCompletion(prompt, options = {}) {
  const defaultOptions = {
    model: OLLAMA_MODEL,
    stream: false,
    temperature: 0.1,
    options: {
      num_predict: 10,
      ...options
    }
  };

  const response = await callOllama('/api/generate', {
    model: defaultOptions.model,
    prompt,
    stream: defaultOptions.stream,
    temperature: defaultOptions.temperature,
    options: defaultOptions.options
  });

  const parsed = JSON.parse(response);
  return parsed?.response || '';
}

module.exports = {
  callOllama,
  isOllamaAvailable,
  chatCompletion,
  textCompletion,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL
};

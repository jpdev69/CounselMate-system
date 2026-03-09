// backend/routes/chatbot.js
const express = require('express');
const http    = require('http');
const router  = express.Router();

const manualStore = require('../utils/manualStore');

const OLLAMA_BASE_URL = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';

/**
 * Call the local Ollama API (same pattern as violationMatcher.js)
 */
function callOllama(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, OLLAMA_BASE_URL);
    const postData = JSON.stringify(data);
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Check if Ollama is reachable (GET /api/tags)
 */
function isOllamaAvailable() {
  return new Promise((resolve) => {
    const url = new URL('/api/tags', OLLAMA_BASE_URL);
    http.get(url.toString(), (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(res.statusCode === 200));
    }).on('error', () => resolve(false));
  });
}

// GET /api/chatbot/manual â€” returns the raw manual text and metadata
router.get('/manual', (req, res) => {
  res.json({
    success: true,
    text: manualStore.getRawManual(),
    info: manualStore.getManualInfo(),
  });
});

// POST /api/chatbot/ask
router.post('/ask', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Message is required' });
  }

  const userMessage = message.trim();

  // Try DeepSeek via Ollama first
  const ollamaUp = await isOllamaAvailable();

  if (!ollamaUp) {
    // Fallback: keyword-based response system
    return res.json({
      success: true,
      reply: getFallbackResponse(userMessage)
    });
  }

  try {
    const raw = await callOllama('/api/chat', {
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: manualStore.getSystemPrompt() },
        { role: 'user', content: userMessage }
      ],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 1024
      }
    });

    const parsed = JSON.parse(raw);
    let reply = parsed?.message?.content || '';

    // DeepSeek sometimes appends special tokens â€” strip them
    reply = reply.replace(/<[^>]+>/g, '').trim();

    if (!reply) {
      reply = 'Sorry, I could not generate a response. Please try again.';
    }

    return res.json({ success: true, reply });
  } catch (err) {
    console.error('Chatbot DeepSeek/Ollama error:', err.message || err);

    // If Ollama fails, use fallback
    return res.json({
      success: true,
      reply: getFallbackResponse(userMessage)
    });
  }
});

/**
 * Fallback responder when Ollama is not available.
 * Searches the currently-loaded manual text for lines matching the user's
 * query keywords, then returns a short excerpt â€” so it works for any
 * uploaded manual, not just the original ISU one.
 */
function getFallbackResponse(message) {
  const msg = message.toLowerCase().trim();

  // â”€â”€ Greetings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const greetings = ['hello','hi','hey','good morning','good afternoon','good evening','greetings','howdy'];
  const metaPhrases = ['what can you do','who are you','what are you','help','how can you help','capabilities','your purpose','introduce yourself'];
  const thanks = ['thank','thanks','salamat','ty','appreciate','got it','that helps'];

  const isGreeting = greetings.some(g => msg === g || msg.startsWith(g + ' ') || msg.startsWith(g + '!'));
  const isMeta     = metaPhrases.some(m => msg.includes(m));
  const isThank    = thanks.some(t => msg.includes(t));

  const info = manualStore.getManualInfo();
  const manualName = (info?.filename || 'the Student Manual').replace(/\.[^.]+$/, '');

  if (isGreeting || isMeta) {
    return `Hello! I'm the **GuidanceOS Assistant** powered by **${manualName}**. Ask me anything about this manual and I'll find the relevant information for you.`;
  }
  if (isThank) {
    return "You're welcome! Feel free to ask anything else about the student manual.";
  }

  // â”€â”€ Search the actual manual text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const raw = manualStore.getRawManual();
  if (!raw) {
    return "The student manual has not been loaded yet. Please ask an administrator to upload it.";
  }

  // Build query words from the user message (strip common stop words)
  const stopWords = new Set(['what','is','are','the','a','an','of','for','to','in','on','how','does','do','i','can','about','tell','me','please','explain','give','list','show']);
  const queryWords = msg
    .replace(/[?!.,"']/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  if (queryWords.length === 0) {
    return "Could you be more specific? Try asking about a particular topic from the manual.";
  }

  const lines = raw.split('\n');

  // Score each line: +1 for every query word that appears in it
  const scored = lines.map((line, idx) => {
    const lower = line.toLowerCase();
    const score = queryWords.reduce((s, w) => s + (lower.includes(w) ? 1 : 0), 0);
    return { idx, line, score };
  }).filter(r => r.score > 0);

  if (scored.length === 0) {
    return `I couldn't find anything about that in **${manualName}**. Try rephrasing your question or asking about a different topic.`;
  }

  // Sort by score descending, take the best-scoring cluster
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);

  // Collect context: for the top matches, grab 2 lines before and after as context
  const included = new Set();
  const CONTEXT = 2;
  const MAX_LINES = 25;
  const resultLines = [];

  for (const { idx } of scored) {
    if (resultLines.length >= MAX_LINES) break;
    const start = Math.max(0, idx - CONTEXT);
    const end   = Math.min(lines.length - 1, idx + CONTEXT);
    for (let i = start; i <= end && resultLines.length < MAX_LINES; i++) {
      if (!included.has(i) && lines[i].trim()) {
        included.add(i);
        resultLines.push(lines[i]);
      }
    }
  }

  const excerpt = resultLines.join('\n').trim();
  return `Here's what **${manualName}** says about that:\n\n${excerpt}\n\n*(This is an excerpt from the manual. For a complete answer, the AI assistant requires a connection to Ollama.)*`;
}

module.exports = router;

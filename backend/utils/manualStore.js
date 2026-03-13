// backend/utils/manualStore.js
// Singleton that owns the uploaded document in memory.
// chatbot.js and admin.js both import from here so a fresh upload is
// immediately visible to the chatbot without a server restart.

const fs   = require('fs');
const path = require('path');
const searcher = require('./semanticSearch');

const UPLOAD_DIR  = path.resolve(__dirname, '../uploads');
const UPLOAD_PATH = path.join(UPLOAD_DIR, 'student-manual.txt');
const META_PATH   = path.join(UPLOAD_DIR, 'student-manual.meta.json');

// ── mutable state ─────────────────────────────────────────────────
let _rawManual    = '';
let _systemPrompt = '';
let _manualInfo   = null;

// ── helpers ───────────────────────────────────────────────────────
function buildSystemPrompt(manual, manualName) {
  const displayName = manualName || 'the uploaded manual';
  return `You are the GuidanceOS Assistant, a helpful chatbot for **${displayName}**. You help users look up information from this document.

YOUR SOLE SOURCE OF TRUTH — ${displayName.toUpperCase()}:
===BEGIN===
${manual}
===END===

RULES:
1. For greetings ("hello", "hi", "hey", etc.) or meta-questions ("what can you do?", "help", "who are you?"), respond warmly. Introduce yourself as the GuidanceOS Assistant for "${displayName}" and briefly explain what you can help with based on the document content.
2. Answer questions using ONLY the document content above. Do not use outside knowledge.
3. Always cite specific section numbers when applicable.
4. Be accurate — only provide information from the document. Do not invent rules.
5. Be helpful, professional, and conversational.
6. Keep responses concise but complete.
7. If a question is clearly unrelated to this document's content (cooking, movies, trivia, etc.), politely explain your scope and suggest what you CAN help with. Do NOT just reject — always guide the user.
8. When uncertain if a question is relevant, lean toward being helpful.
9. Never refer to this document as "the student manual" unless that is its actual name ("${displayName}"). Always use the document's real name.`;
}

function buildContextualPrompt(context, query, manualName) {
  const displayName = manualName || 'the uploaded manual';
  return `You are the GuidanceOS Assistant, a helpful chatbot for **${displayName}**. 

CONTEXT FROM ${displayName.toUpperCase()}:
===BEGIN===
${context}
===END===

User Question: ${query}

RULES:
1. Answer using ONLY the context provided above. If the context doesn't contain the answer, say "I couldn't find that information in the manual."
2. Be helpful and conversational.
3. Reference specific sections if possible.
4. Keep responses concise but complete.`;
}

// ── core loader ───────────────────────────────────────────────────
function loadManual() {
  if (!fs.existsSync(UPLOAD_PATH)) {
    _rawManual    = '';
    _systemPrompt = buildSystemPrompt('');
    _manualInfo   = { filename: null, source: 'none', size: 0, chars: 0, lines: 0, uploadedAt: null };
    console.log('⚠️  No manual uploaded yet.');
    return;
  }

  try {
    const text = fs.readFileSync(UPLOAD_PATH, 'utf-8');
    const stat = fs.statSync(UPLOAD_PATH);

    // Read the original upload filename from sidecar meta file
    let displayName = 'student-manual.txt';
    if (fs.existsSync(META_PATH)) {
      try {
        const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
        if (meta.originalname) displayName = meta.originalname;
      } catch { /* ignore corrupt meta */ }
    }

    const manualTitle = displayName.replace(/\.[^.]+$/, '');

    _rawManual    = text;
    _systemPrompt = buildSystemPrompt(text, manualTitle);
    _manualInfo   = {
      filename:   displayName,
      source:     'upload',
      size:       stat.size,
      chars:      text.length,
      lines:      text.split('\n').length,
      uploadedAt: stat.mtime.toISOString(),
    };

    // Index for semantic search
    searcher.indexManual(text);

    console.log(`✅ Manual loaded from upload (${displayName}): ${text.length} chars`);
  } catch (err) {
    console.error('❌ Failed to load Student Manual:', err.message);
    _rawManual    = '';
    _systemPrompt = buildSystemPrompt('');
    _manualInfo   = { filename: null, source: 'none', size: 0, chars: 0, lines: 0, uploadedAt: null };
  }
}

// Load at startup
loadManual();

// ── public API ────────────────────────────────────────────────────
module.exports = {
  getRawManual:      () => _rawManual,
  getSystemPrompt:   () => _systemPrompt,
  getManualInfo:     () => _manualInfo,
  getContextForQuery: (query) => searcher.getContext(query),
  buildContextualPrompt: (context, query) => buildContextualPrompt(context, query, _manualInfo?.filename?.replace(/\.[^.]+$/, '') || 'the manual'),
  reloadManual:      loadManual,
  UPLOAD_DIR,
  UPLOAD_PATH,
};

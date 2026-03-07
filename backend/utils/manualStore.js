// backend/utils/manualStore.js
// Singleton that owns the Student Manual in memory.
// chatbot.js and admin.js both import from here so a fresh upload is
// immediately visible to the chatbot without a server restart.

const fs   = require('fs');
const path = require('path');

const UPLOAD_DIR  = path.resolve(__dirname, '../uploads');
const UPLOAD_PATH = path.join(UPLOAD_DIR, 'student-manual.txt');
const META_PATH   = path.join(UPLOAD_DIR, 'student-manual.meta.json');
const DEFAULT_PATH = path.resolve(__dirname, '../../Isabela State University - Student Manual.txt');

// ── mutable state ─────────────────────────────────────────────────
let _rawManual     = '';
let _focusedManual = '';
let _systemPrompt  = '';
let _manualInfo    = null;

// ── helpers ───────────────────────────────────────────────────────
function extractRelevantSections(fullText) {
  if (!fullText) return 'Student manual content unavailable.';

  const lines = fullText.split('\n');
  const regions = [
    { start: 'B. RETENTION POLICIES',      stop: '2. ADVANCED CREDITS' },
    { start: '8. ACADEMIC STATUS',          stop: '9. ACADEMIC LOAD' },
    { start: '15. CLASS ATTENDANCE',        stop: '16. CLASS SIZE' },
    { start: '24. HONORABLE DISMISSAL',     stop: '25. MODES OF PAYMENT' },
    { start: '28. SCHOOL UNIFORM',          stop: '31. PROVISION' },
    { start: 'RIGHTS OF THE STUDENTS',      stop: 'RULE II' },
    { start: 'PROCEDURES FOR THE SETTLEMENT', stop: 'POSTERS, BANNERS' },
    { start: 'REPUBLIC ACT 9165',           stop: 'REPUBLIC ACT 7079' },
  ];

  const extracted = [];
  for (const region of regions) {
    let capturing = false;
    for (let i = 0; i < lines.length; i++) {
      const upper = lines[i].toUpperCase().trim();
      if (!capturing && upper.includes(region.start)) { capturing = true; }
      if (capturing && region.stop && upper.includes(region.stop)) { break; }
      if (capturing) extracted.push(lines[i]);
    }
  }

  const result = extracted.join('\n').trim();
  return result || fullText;
}

function buildSystemPrompt(focusedManual, manualName) {
  const displayName = manualName || 'the uploaded manual';
  return `You are the GuidanceOS Assistant, a helpful chatbot for **${displayName}**. You help users look up information from this document.

YOUR SOLE SOURCE OF TRUTH — ${displayName.toUpperCase()}:
===BEGIN===
${focusedManual}
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

// ── core loader ───────────────────────────────────────────────────
function loadManual() {
  // Prefer uploaded file when present
  let filePath = DEFAULT_PATH;
  let source   = 'default';

  if (fs.existsSync(UPLOAD_PATH)) {
    filePath = UPLOAD_PATH;
    source   = 'upload';
  }

  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    const stat = fs.statSync(filePath);

    // Read the original upload filename from sidecar meta file (if any)
    let displayName = path.basename(filePath);
    if (source === 'upload' && fs.existsSync(META_PATH)) {
      try {
        const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
        if (meta.originalname) displayName = meta.originalname;
      } catch { /* ignore corrupt meta */ }
    }

    const manualTitle = displayName.replace(/\.[^.]+$/, '');

    _rawManual     = text;
    _focusedManual = extractRelevantSections(text);
    _systemPrompt  = buildSystemPrompt(_focusedManual, manualTitle);
    _manualInfo = {
      filename:   displayName,
      source,
      size:       stat.size,
      chars:      text.length,
      lines:      text.split('\n').length,
      uploadedAt: source === 'upload' ? stat.mtime.toISOString() : null,
    };

    console.log(`✅ Manual loaded from ${source} (${filePath}): ${text.length} chars`);
  } catch (err) {
    console.error('❌ Failed to load Student Manual:', err.message);
    _rawManual     = '';
    _focusedManual = 'Student manual content unavailable.';
    _systemPrompt  = buildSystemPrompt(_focusedManual);
    _manualInfo    = { filename: null, source: 'none', size: 0, chars: 0, lines: 0, uploadedAt: null };
  }
}

// Load at startup
loadManual();

// ── public API ────────────────────────────────────────────────────
module.exports = {
  getRawManual:     () => _rawManual,
  getFocusedManual: () => _focusedManual,
  getSystemPrompt:  () => _systemPrompt,
  getManualInfo:    () => _manualInfo,
  reloadManual:     loadManual,
  UPLOAD_DIR,
  UPLOAD_PATH,
};

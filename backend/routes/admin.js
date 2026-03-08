const express    = require('express');
const multer     = require('multer');
const fs         = require('fs');
const path       = require('path');
const router     = express.Router();
const db         = require('../config/database');
const manualStore = require('../utils/manualStore');

// ── multer setup for Student Manual upload ────────────────────────────────
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(manualStore.UPLOAD_DIR)) {
      fs.mkdirSync(manualStore.UPLOAD_DIR, { recursive: true });
    }
    cb(null, manualStore.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, 'student-manual.txt'); // always overwrite the same file
  },
});

const manualUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.txt' || !file.mimetype.startsWith('text/')) {
      return cb(new Error('Only plain-text (.txt) files are accepted'));
    }
    cb(null, true);
  },
});

// Ensure admin tables exist on startup (CREATE IF NOT EXISTS — safe to call repeatedly)
async function ensureAdminTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(128) NOT NULL,
      code       VARCHAR(32)  NOT NULL UNIQUE,
      created_at TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS course_year_levels (
      id          SERIAL PRIMARY KEY,
      course_id   INTEGER     NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      year_level  VARCHAR(32) NOT NULL,
      sort_order  INTEGER     DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(course_id, year_level)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS course_sections (
      id             SERIAL PRIMARY KEY,
      year_level_id  INTEGER     NOT NULL REFERENCES course_year_levels(id) ON DELETE CASCADE,
      name           VARCHAR(32) NOT NULL,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(year_level_id, name)
    )
  `);
}

ensureAdminTables().catch(err => console.warn('ensureAdminTables warning:', err.message));

// ── COURSES ──────────────────────────────────────────────────────────────────

// GET /api/admin/courses
router.get('/courses', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM course_year_levels WHERE course_id = c.id)::int AS year_level_count
      FROM courses c
      ORDER BY c.name
    `);
    res.json({ success: true, courses: result.rows });
  } catch (err) {
    console.error('Get courses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/courses
router.post('/courses', async (req, res) => {
  const name = (req.body.name || '').toString().trim();
  const code = (req.body.code || '').toString().trim().toUpperCase();
  if (!name) return res.status(400).json({ error: 'Course name is required' });
  if (!code) return res.status(400).json({ error: 'Course code is required' });
  try {
    const result = await db.query(
      `INSERT INTO courses (name, code) VALUES ($1, $2) RETURNING *`,
      [name, code]
    );
    res.json({ success: true, course: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A course with this code already exists' });
    console.error('Create course error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/courses/:id
router.put('/courses/:id', async (req, res) => {
  const name = (req.body.name || '').toString().trim();
  const code = (req.body.code || '').toString().trim().toUpperCase();
  if (!name) return res.status(400).json({ error: 'Course name is required' });
  if (!code) return res.status(400).json({ error: 'Course code is required' });
  try {
    const result = await db.query(
      `UPDATE courses SET name = $1, code = $2 WHERE id = $3 RETURNING *`,
      [name, code, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    res.json({ success: true, course: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A course with this code already exists' });
    console.error('Update course error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/courses/:id
router.delete('/courses/:id', async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM courses WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── YEAR LEVELS ───────────────────────────────────────────────────────────────

// GET /api/admin/courses/:courseId/year-levels
router.get('/courses/:courseId/year-levels', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT yl.*,
        (SELECT COUNT(*) FROM course_sections WHERE year_level_id = yl.id)::int AS section_count
       FROM course_year_levels yl
       WHERE yl.course_id = $1
       ORDER BY yl.sort_order, yl.year_level`,
      [req.params.courseId]
    );
    res.json({ success: true, yearLevels: result.rows });
  } catch (err) {
    console.error('Get year levels error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/courses/:courseId/year-levels
router.post('/courses/:courseId/year-levels', async (req, res) => {
  const year_level = (req.body.year_level || '').toString().trim();
  if (!year_level) return res.status(400).json({ error: 'Year level is required' });
  const sort_order = parseInt(req.body.sort_order, 10) || 0;
  try {
    const result = await db.query(
      `INSERT INTO course_year_levels (course_id, year_level, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.courseId, year_level, sort_order]
    );
    res.json({ success: true, yearLevel: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This year level already exists for this course' });
    console.error('Add year level error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/year-levels/:id
router.put('/year-levels/:id', async (req, res) => {
  const year_level = (req.body.year_level || '').toString().trim();
  if (!year_level) return res.status(400).json({ error: 'Year level is required' });
  try {
    const result = await db.query(
      `UPDATE course_year_levels SET year_level = $1 WHERE id = $2 RETURNING *`,
      [year_level, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Year level not found' });
    res.json({ success: true, yearLevel: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This year level already exists for this course' });
    console.error('Update year level error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/year-levels/:id
router.delete('/year-levels/:id', async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM course_year_levels WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Year level not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete year level error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── SECTIONS ──────────────────────────────────────────────────────────────────

// GET /api/admin/year-levels/:yearLevelId/sections
router.get('/year-levels/:yearLevelId/sections', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM course_sections WHERE year_level_id = $1 ORDER BY name`,
      [req.params.yearLevelId]
    );
    res.json({ success: true, sections: result.rows });
  } catch (err) {
    console.error('Get sections error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/year-levels/:yearLevelId/sections
router.post('/year-levels/:yearLevelId/sections', async (req, res) => {
  const name = (req.body.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'Section name is required' });
  try {
    const result = await db.query(
      `INSERT INTO course_sections (year_level_id, name) VALUES ($1, $2) RETURNING *`,
      [req.params.yearLevelId, name]
    );
    res.json({ success: true, section: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This section already exists for this year level' });
    console.error('Add section error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/sections/:id
router.put('/sections/:id', async (req, res) => {
  const name = (req.body.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'Section name is required' });
  try {
    const result = await db.query(
      `UPDATE course_sections SET name = $1 WHERE id = $2 RETURNING *`,
      [name, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    res.json({ success: true, section: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This section already exists for this year level' });
    console.error('Update section error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/sections/:id
router.delete('/sections/:id', async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM course_sections WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Section not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/violation-types
router.get('/violation-types', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, code, description, category, section_ref, requires_admission_slip
       FROM violation_types
       WHERE section_ref IS NOT NULL
       ORDER BY category DESC, section_ref, id`
    );
    res.json({ success: true, violationTypes: result.rows });
  } catch (err) {
    console.error('Get violation types error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/violation-types/:id
router.put('/violation-types/:id', async (req, res) => {
  const { requires_admission_slip } = req.body;
  if (typeof requires_admission_slip !== 'boolean') {
    return res.status(400).json({ error: 'requires_admission_slip must be a boolean' });
  }
  try {
    const result = await db.query(
      `UPDATE violation_types SET requires_admission_slip = $1 WHERE id = $2 RETURNING *`,
      [requires_admission_slip, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Violation type not found' });
    res.json({ success: true, violationType: result.rows[0] });
  } catch (err) {
    console.error('Update violation type error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── VIOLATIONS UPLOAD (txt → LLM extraction) ─────────────────────────────────

const http = require('http');
const OLLAMA_BASE_URL = process.env.OLLAMA_URL   || 'http://localhost:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'deepseek-v3.1:671b-cloud';

function callOllamaAdmin(data) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/chat', OLLAMA_BASE_URL);
    const postData = JSON.stringify(data);
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function isOllamaAvailableAdmin() {
  try {
    const response = await new Promise((resolve, reject) => {
      const url = new URL('/api/tags', OLLAMA_BASE_URL);
      const req = http.request(url, { method: 'GET' }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.end();
    });
    return response.length > 0;
  } catch {
    return false;
  }
}

// multer for violations .txt (memory storage — read text, discard file)
const violationsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.txt' || !file.mimetype.startsWith('text/')) {
      return cb(new Error('Only plain-text (.txt) files are accepted for violations'));
    }
    cb(null, true);
  },
});

// POST /api/admin/violations/extract — LLM extraction only, does NOT save to DB
router.post('/violations/extract', (req, res) => {
  violationsUpload.single('violations')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const docText = req.file.buffer.toString('utf-8').trim();
    if (!docText) {
      return res.status(400).json({ error: 'Uploaded file is empty' });
    }

    // Check Ollama
    const ollamaUp = await isOllamaAvailableAdmin();
    if (!ollamaUp) {
      return res.status(503).json({ error: 'AI service (Ollama) is not reachable. Cannot extract violations without it.' });
    }

    // Ask the LLM to extract violations
    const systemPrompt = `You are a data extraction assistant. Your task is to find student discipline violations, offenses, infractions, or prohibited acts in the document.

If the document does NOT contain any student discipline violations or offenses (e.g. it is a recipe, letter, schedule, financial report, or any non-discipline document), output exactly: []

If violations ARE found, output ONLY a raw JSON array with no explanation, no markdown, no code fences. Each element:
{
  "code": "SCREAMING_SNAKE_CASE key derived from the violation name",
  "description": "exact violation text from the document",
  "category": "minor" or "major" (if document does not distinguish, infer: serious offenses = major, lesser offenses = minor),
  "section_ref": "section/article number if present, otherwise use sequential numbering like 1.1, 1.2"
}

Rules:
- Include ALL violations/offenses/infractions/prohibited acts found in the document.
- Never skip items because of formatting differences.
- If no section numbers exist, assign sequential ones (1.1, 1.2, … for minor; 2.1, 2.2, … for major).
- Output ONLY the JSON array starting with [ and ending with ]. No prose, no explanation.`;

    let rawLLM;
    try {
      rawLLM = await callOllamaAdmin({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract all violations from this document:\n\n${docText}` },
        ],
        stream: false,
        options: {
          temperature: 0,
          num_predict: 4096,
          num_ctx: 8192,
        },
      });
    } catch (llmErr) {
      console.error('Violations LLM call error:', llmErr.message);
      return res.status(503).json({ error: 'AI service failed to respond. Please try again.' });
    }

    // Parse the LLM response — robustly extract the JSON array
    let entries;

    // Step 1: parse the Ollama HTTP response envelope
    let rawParsed;
    try {
      rawParsed = JSON.parse(rawLLM);
    } catch (e) {
      console.error('Violations: Ollama response is not valid JSON (first 500):', String(rawLLM).slice(0, 500));
      return res.status(503).json({ error: 'AI service returned an unexpected response. Please try again.' });
    }

    // Step 2: extract the model's text content and parse the JSON array inside it
    {
      let content = (rawParsed?.message?.content || '').trim();
      console.log('[violations extract] LLM content length:', content.length, '| first 400:', content.slice(0, 400));

      // Strip ALL markdown code fences wherever they appear
      content = content.replace(/```[\w]*\n?/gi, '').replace(/```/g, '').trim();

      // Find the JSON array — prefer [{...}] to avoid matching inline [brackets]
      if (!content.startsWith('[')) {
        const objArray = content.match(/\[\s*\{[\s\S]*/);
        if (objArray) content = objArray[0];
      }

      // Try strict parse first
      try {
        entries = JSON.parse(content);
      } catch (_) {
        // Output was truncated — recover all complete objects from partial JSON
        const recovered = [];
        const objRegex = /\{[^{}]*\}/g;
        let m;
        while ((m = objRegex.exec(content)) !== null) {
          try {
            const obj = JSON.parse(m[0]);
            if (obj && (obj.description || obj.code)) recovered.push(obj);
          } catch { /* skip malformed object */ }
        }
        if (recovered.length > 0) {
          console.warn(`[violations extract] JSON was truncated — recovered ${recovered.length} objects`);
          entries = recovered;
        } else {
          console.error('Violations: Could not parse LLM content as JSON and recovery found nothing');
          return res.status(422).json({
            error: 'Could not parse violations from the document. The AI could not identify structured violation data — please ensure the document contains a discipline/offenses section.',
          });
        }
      }
    }

    if (!Array.isArray(entries)) {
      return res.status(422).json({ error: 'Could not extract violations from the document. Please ensure it contains a violations or offenses section.' });
    }
    if (entries.length === 0) {
      return res.status(422).json({ error: 'The uploaded document does not appear to contain student discipline violations or offenses. Please upload a student manual or disciplinary policy document.' });
    }

    // Normalise and validate every extracted entry — be lenient with missing fields
    let idx = 0;
    for (const e of entries) {
      // Derive missing code from description
      if (!e.code && e.description) {
        e.code = e.description.toString().trim().toUpperCase()
          .replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 128);
      }
      // Default category to major if missing/unknown
      if (!['minor', 'major'].includes(e.category)) {
        e.category = 'major';
      }
      // Assign sequential section_ref if missing
      if (!e.section_ref) {
        e.section_ref = `${e.category === 'minor' ? '1' : '2'}.${++idx}`;
      }
      if (!e.code || !e.description) {
        return res.status(422).json({ error: `Incomplete violation at index ${idx}: could not determine code or description.` });
      }
    }

    // Return extracted violations + current DB violations for side-by-side review
    const existing = await db.query(
      `SELECT id, code, description, category, section_ref FROM violation_types WHERE section_ref IS NOT NULL ORDER BY category DESC, section_ref, id`
    );
    res.json({ success: true, violations: entries, existing: existing.rows });
  });
});

// POST /api/admin/violations/save — user-confirmed violations → upsert to DB
router.post('/violations/save', async (req, res) => {
  const entries = req.body?.violations;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'violations array is required' });
  }
  try {
    for (const vt of entries) {
      if (!vt.code || !vt.description || !vt.category || !vt.section_ref) continue;
      await db.query(
        `INSERT INTO violation_types (code, description, category, section_ref)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
           SET description = EXCLUDED.description,
               category    = EXCLUDED.category,
               section_ref = EXCLUDED.section_ref`,
        [
          vt.code.toString().trim().toUpperCase().slice(0, 128),
          vt.description.toString().trim().slice(0, 256),
          vt.category,
          vt.section_ref.toString().trim().slice(0, 16),
        ]
      );
    }
    const result = await db.query(
      `SELECT id, code, description, category, section_ref, requires_admission_slip
       FROM violation_types
       WHERE section_ref IS NOT NULL
       ORDER BY category DESC, section_ref, id`
    );
    res.json({ success: true, violationTypes: result.rows });
  } catch (dbErr) {
    console.error('Violations save DB error:', dbErr);
    res.status(500).json({ error: dbErr.message });
  }
});

// ── STUDENT MANUAL ───────────────────────────────────────────────────────────

// GET /api/admin/student-manual/info
router.get('/student-manual/info', (req, res) => {
  res.json({ success: true, info: manualStore.getManualInfo() });
});

// POST /api/admin/student-manual  — upload a new .txt manual
router.post('/student-manual', (req, res) => {
  manualUpload.single('manual')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Persist the original filename so the UI can display it
    const metaPath = path.join(manualStore.UPLOAD_DIR, 'student-manual.meta.json');
    fs.writeFileSync(metaPath, JSON.stringify({ originalname: req.file.originalname }));

    // Reload the in-memory manual so the chatbot picks it up immediately
    manualStore.reloadManual();

    res.json({ success: true, info: manualStore.getManualInfo() });
  });
});

module.exports = router;

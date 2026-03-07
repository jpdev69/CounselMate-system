const express = require('express');
const router = express.Router();
const db = require('../config/database');

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

module.exports = router;

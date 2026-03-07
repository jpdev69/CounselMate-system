const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Create a new student report (violation without admission slip)
router.post('/', async (req, res) => {
  const { studentName, year, section, course, student_id, violation_type_id, description, remarks } = req.body;

  if (!violation_type_id) {
    return res.status(400).json({ error: 'Violation type is required' });
  }
  if (!description || !description.toString().trim()) {
    return res.status(400).json({ error: 'Violation description is required' });
  }

  // If no existing student id is provided, validate required student fields
  if (!student_id) {
    if (!studentName || !studentName.toString().trim() || !section || !section.toString().trim()) {
      return res.status(400).json({ error: 'Student name and section are required' });
    }
  }

  try {
    // Determine student id: use provided student_id or insert a new student
    let studentId;
    if (student_id) {
      const existing = await db.query('SELECT id FROM students WHERE id = $1 LIMIT 1', [student_id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Provided student_id not found' });
      }
      studentId = existing.rows[0].id;
    } else {
      const studentResult = await db.query(
        `INSERT INTO students (student_id, full_name, year, section)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [`STU-${Date.now()}`, studentName, year, section]
      );
      studentId = studentResult.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO student_reports (student_id, violation_type_id, description, remarks, course, status)
       VALUES ($1, $2, $3, $4, $5, 'reported')
       RETURNING *`,
      [studentId, violation_type_id, description, remarks || null, course || null]
    );

    // Return joined report
    const selectQuery = `
      SELECT
        sr.*,
        s.full_name AS student_name,
        s.year,
        s.section,
        vt.code AS violation_code,
        vt.description AS violation_description,
        vt.category AS violation_category
      FROM student_reports sr
      LEFT JOIN students s ON sr.student_id = s.id
      LEFT JOIN violation_types vt ON sr.violation_type_id = vt.id
      WHERE sr.id = $1
    `;
    const reportResult = await db.query(selectQuery, [result.rows[0].id]);

    res.json({ success: true, report: reportResult.rows[0], message: 'Student report created successfully' });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// Get all student reports
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        sr.*,
        s.full_name AS student_name,
        s.year,
        s.section,
        vt.code AS violation_code,
        vt.description AS violation_description,
        vt.category AS violation_category
      FROM student_reports sr
      LEFT JOIN students s ON sr.student_id = s.id
      LEFT JOIN violation_types vt ON sr.violation_type_id = vt.id
      ORDER BY sr.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update report status (resolve)
router.put('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const query = `
      UPDATE student_reports
      SET status = 'resolved',
          remarks = COALESCE($1, remarks),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [remarks || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const selectQuery = `
      SELECT
        sr.*,
        s.full_name AS student_name,
        s.year,
        s.section,
        vt.code AS violation_code,
        vt.description AS violation_description,
        vt.category AS violation_category
      FROM student_reports sr
      LEFT JOIN students s ON sr.student_id = s.id
      LEFT JOIN violation_types vt ON sr.violation_type_id = vt.id
      WHERE sr.id = $1
    `;
    const reportResult = await db.query(selectQuery, [id]);

    res.json({ success: true, report: reportResult.rows[0] });
  } catch (error) {
    console.error('Resolve report error:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// Delete a report (only 'reported' status)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Invalid report id' });
    }

    const reportRes = await db.query('SELECT id, status FROM student_reports WHERE id = $1', [id]);
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const deleteRes = await db.query('DELETE FROM student_reports WHERE id = $1 RETURNING *', [id]);
    res.json({ success: true, message: 'Report deleted successfully', report: deleteRes.rows[0] });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;

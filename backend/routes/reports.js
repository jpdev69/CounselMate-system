const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Create a new student report (violation without admission slip)
router.post('/', async (req, res) => {
  const { studentName, year, section, course, schoolYear, term, student_id, violation_type_id, description, remarks, updateExistingStudent } = req.body;

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

      // If updateExistingStudent is true, update the student's information
      if (updateExistingStudent) {
        // Check if override is enabled
        let overrideEnabled = false;
        try {
          const overrideResult = await db.query(`
            SELECT value FROM admin_settings 
            WHERE key = 'student_edit_override'
          `);
          overrideEnabled = overrideResult.rows.length > 0 && overrideResult.rows[0].value === 'true';
        } catch (err) {
          console.warn('Failed to check student edit override:', err.message);
        }

        if (overrideEnabled) {
          // Override enabled - update master student record with latest information
          // This ensures when override is turned OFF, system uses most recent data
          const updates = [];
          const values = [];
          let paramIndex = 1;

          if (year) {
            updates.push(`year = $${paramIndex++}`);
            values.push(year);
          }
          if (section) {
            updates.push(`section = $${paramIndex++}`);
            values.push(section);
          }
          if (course) {
            updates.push(`current_course = $${paramIndex++}`);
            values.push(course);
          }
          if (schoolYear) {
            updates.push(`last_school_year = $${paramIndex++}`);
            values.push(schoolYear);
          }
          if (term) {
            updates.push(`last_term = $${paramIndex++}`);
            values.push(term);
          }

          if (updates.length > 0) {
            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(studentId);

            const updateQuery = `
              UPDATE students 
              SET ${updates.join(', ')}
              WHERE id = $${paramIndex}
            `;
            
            await db.query(updateQuery, values);
            console.log(`Updated master student record ${studentId} with latest information from override session`);
          }
        }
      }
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
      `INSERT INTO student_reports (student_id, violation_type_id, description, remarks, course, school_year, term, year, section, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'reported')
       RETURNING *`,
      [studentId, violation_type_id, description, remarks || null, course || null, schoolYear || null, term || null, year || null, section || null]
    );

    // Return joined report
    const selectQuery = `
      SELECT
        sr.*,
        s.full_name AS student_name,
        sr.year,
        sr.section,
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
        sr.year,
        sr.section,
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

// Update a report (general update)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, remarks } = req.body;

    if (!description && !remarks) {
      return res.status(400).json({ error: 'Description or remarks is required for update' });
    }

    // Check if report exists
    const checkQuery = 'SELECT id FROM student_reports WHERE id = $1';
    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Build update query dynamically
    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    if (description) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(description);
    }

    if (remarks !== undefined) {
      updateFields.push(`remarks = $${paramIndex++}`);
      updateValues.push(remarks);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(id);

    const updateQuery = `
      UPDATE student_reports
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(updateQuery, updateValues);

    res.json({ success: true, report: result.rows[0] });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
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

const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Your database connection

// Issue admission slip
router.post('/issue', async (req, res) => {
  const { studentName, year, section } = req.body;
  try {
    const slipNumber = `SLIP-${Date.now()}`;

    const studentResult = await db.query(
      `INSERT INTO students (student_id, full_name, year, section) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [`STU-${Date.now()}`, studentName, year, section]
    );

    const studentId = studentResult.rows[0].id;

    const slipResult = await db.query(
      `INSERT INTO admission_slips (slip_number, student_id, issued_by, status) 
       VALUES ($1, $2, $3, 'issued') 
       RETURNING *`,
      [slipNumber, studentId, 'system']
    );

    try {
      await db.query(
        `INSERT INTO audit_logs (admission_slip_id, user_email, action, old_status, new_status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [slipResult.rows[0].id, 'system@school.edu', 'SLIP_ISSUED', null, 'issued']
      );
    } catch (e) {
      console.warn('Failed to insert audit log (continuing):', e.message);
    }

    // return joined slip
    const selectQuery = `
      SELECT 
        asl.*, 
        s.full_name as student_name,
        s.year,
        s.section,
        vt.code as violation_code,
        vt.description as violation_description
      FROM admission_slips asl
      LEFT JOIN students s ON asl.student_id = s.id
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      WHERE asl.id = $1
    `;
    const slipResultJoined = await db.query(selectQuery, [slipResult.rows[0].id]);

    res.json({ success: true, slip: slipResultJoined.rows[0], message: 'Admission slip issued successfully' });
  } catch (error) {
    console.error('Issue slip error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all admission slips
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        asl.*,
        s.full_name as student_name,
        s.year,
        s.section,
        vt.code as violation_code,
        vt.description as violation_description
      FROM admission_slips asl
      LEFT JOIN students s ON asl.student_id = s.id
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      ORDER BY asl.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get slips error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete admission slip form
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { violation_type_id, description, teacher_comments } = req.body;

    const query = `
      UPDATE admission_slips 
      SET violation_type_id = $1, 
          description = $2, 
          teacher_comments = $3, 
          status = 'form_completed',
          form_completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const values = [violation_type_id, description, teacher_comments, id];
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admission slip not found' });
    }
    // add audit log (best-effort if audit_logs table exists)
    try {
      await db.query(
        `INSERT INTO audit_logs (admission_slip_id, user_email, action, old_status, new_status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [id, 'counselor@university.edu', 'FORM_COMPLETED', 'issued', 'form_completed']
      );
    } catch (e) {
      console.warn('Failed to insert audit log (continuing):', e.message);
    }

    // Return the updated slip with joined fields for table-friendly format
    const selectQuery = `
      SELECT 
        asl.*, 
        s.full_name as student_name,
        s.year,
        s.section,
        vt.code as violation_code,
        vt.description as violation_description
      FROM admission_slips asl
      LEFT JOIN students s ON asl.student_id = s.id
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      WHERE asl.id = $1
    `;
    const slipResult = await db.query(selectQuery, [id]);

    res.json({ 
      success: true, 
      slip: slipResult.rows[0] 
    });
  } catch (error) {
    console.error('Complete form error:', error);
    res.status(500).json({ 
      error: 'Failed to complete form' 
    });
  }
});

// Approve admission slip
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE admission_slips 
      SET status = 'approved',
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admission slip not found' });
    }
    try {
      await db.query(
        `INSERT INTO audit_logs (admission_slip_id, user_email, action, old_status, new_status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [id, 'counselor@university.edu', 'SLIP_APPROVED', 'form_completed', 'approved']
      );
    } catch (e) {
      console.warn('Failed to insert audit log (continuing):', e.message);
    }

    const selectQuery = `
      SELECT 
        asl.*, 
        s.full_name as student_name,
        s.year,
        s.section,
        vt.code as violation_code,
        vt.description as violation_description
      FROM admission_slips asl
      LEFT JOIN students s ON asl.student_id = s.id
      LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id
      WHERE asl.id = $1
    `;
    const slipResult = await db.query(selectQuery, [id]);

    res.json({ 
      success: true, 
      slip: slipResult.rows[0] 
    });
  } catch (error) {
    console.error('Approve slip error:', error);
    res.status(500).json({ 
      error: 'Failed to approve slip' 
    });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Your database connection

// Issue admission slip
router.post('/issue', async (req, res) => {
  const { studentName, year, section } = req.body;
  // Validate required student fields to avoid creating blank users
  if (!studentName || !studentName.toString().trim() || !section || !section.toString().trim()) {
    return res.status(400).json({ error: 'Student name and section are required to issue an admission slip' });
  }
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

// Verify whether a student with the same name, year and section already exists
router.post('/verify', async (req, res) => {
  try {
    const { firstName, middleName, lastName, year, section } = req.body;

    // Basic validation
    const f = (firstName || '').toString().trim();
    const m = (middleName || '').toString().trim();
    const l = (lastName || '').toString().trim();
    if (!f || !l || !year || !section) {
      return res.status(400).json({ error: 'firstName, lastName, year and section are required for verification' });
    }

    // Build tolerant search: require first and last name tokens to appear in full_name (case-insensitive)
    const firstToken = f;
    const lastToken = l;

    // Use ILIKE for case-insensitive matching and check both tokens exist in full_name
    const query = `
      SELECT id, student_id, full_name, year, section
      FROM students
      WHERE full_name ILIKE $1
        AND full_name ILIKE $2
        AND year = $3
        AND section = $4
      LIMIT 1
    `;
    const values = [`%${firstToken}%`, `%${lastToken}%`, year, section];
    let result;
    try {
      result = await db.query(query, values);
    } catch (sqlErr) {
      console.error('Verify student SQL error:', sqlErr.message || sqlErr);
      return res.status(500).json({ error: 'Database query failed during verification' });
    }

    if (result.rows.length > 0) {
      return res.json({ exists: true, message: 'There already exists a student with the given year level and section', student: result.rows[0] });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Verify student error:', error);
    res.status(500).json({ error: 'Failed to verify student' });
  }
});

// Render a printable admission slip in a new tab/window
router.get('/print-slip', async (req, res) => {
  const slipId = req.query.slip_id;
  if (!slipId) return res.status(400).send('Missing slip_id');

  try {
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
    const slipResult = await db.query(selectQuery, [slipId]);
    if (slipResult.rows.length === 0) return res.status(404).send('Slip not found');

    const slip = slipResult.rows[0];

    // Ensure student info exists before printing
    if (!slip.student_name || !slip.section) {
      return res.status(400).send('Cannot print slip: missing student name or section');
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Admission Slip - ${slip.slip_number}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .slip-info { margin: 20px 0; }
            .field { margin: 10px 0; }
            .label { font-weight: bold; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>UNIVERSITY ADMISSION SLIP</h1>
            <h2>Policy Violation Notification</h2>
          </div>
          <div class="slip-info">
            <div class="field"><span class="label">Slip Number:</span> ${slip.slip_number}</div>
            <div class="field"><span class="label">Student Name:</span> ${slip.student_name}</div>
            <div class="field"><span class="label">Year & Section:</span> ${slip.year} - ${slip.section}</div>
            <div class="field"><span class="label">Date Issued:</span> ${new Date(slip.created_at || Date.now()).toLocaleDateString()}</div>
            <div class="field"><span class="label">Violation:</span> ${slip.violation_description || '—'}</div>
            <div class="field"><span class="label">Description:</span> ${slip.description || '—'}</div>
          </div>
          <div class="instructions">
            <p><strong>Instructions:</strong></p>
            <p>1. This admission slip must be filled out completely by the student</p>
            <p>2. Return the completed form to the guidance counselor</p>
            <p>3. Failure to comply may result in further disciplinary action</p>
          </div>
          <div class="footer">
            <p>Generated by CounselMate System</p>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Print slip error:', error);
    res.status(500).send('Failed to generate print view');
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

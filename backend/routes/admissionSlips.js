const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Your database connection

// Issue admission slip
router.post('/issue', async (req, res) => {
  const { studentName, year, section, course, student_id } = req.body;

  // If no existing student id is provided, validate required student fields to avoid creating blank users
  if (!student_id) {
    if (!studentName || !studentName.toString().trim() || !section || !section.toString().trim()) {
      return res.status(400).json({ error: 'Student name and section are required to issue an admission slip' });
    }
  }
  try {
    const slipNumber = `SLIP-${Date.now()}`;
    // Determine student id: use provided student_id when present, otherwise insert a new student
    let studentId;
    if (student_id) {
      // Verify that the provided student exists
      const existing = await db.query(`SELECT id FROM students WHERE id = $1 LIMIT 1`, [student_id]);
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

    const slipResult = await db.query(
      `INSERT INTO admission_slips (slip_number, student_id, issued_by, status, course) 
       VALUES ($1, $2, $3, 'issued', $4) 
       RETURNING *`,
      [slipNumber, studentId, 'system', course || null]
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

    // First, check whether the full name (first + last tokens) already exists anywhere in the
    // `students` table regardless of year or section. If it does, treat it as a duplicate.
    // Use regex whole-word matching to avoid substring collisions (e.g., Romualdo vs Romualdez).
    // PostgreSQL supports \m and \M for start/end of word in its regex flavor. Use case-insensitive match (~*).
    const queryNameOnly = `
      SELECT id, student_id, full_name, year, section
      FROM students
      WHERE full_name ~* $1
        AND full_name ~* $2
      LIMIT 1
    `;
    // Build regex patterns that match whole words: \mWORD\M
    const valuesNameOnly = [`\\m${firstToken}\\M`, `\\m${lastToken}\\M`];

    let result;
    try {
      result = await db.query(queryNameOnly, valuesNameOnly);
    } catch (sqlErr) {
      console.error('Verify student SQL error (name-only regex):', sqlErr.message || sqlErr);
      return res.status(500).json({ error: 'Database query failed during verification' });
    }

    if (result.rows.length > 0) {
      // Name exists somewhere in the system — consider it a duplicate regardless of year/section
      return res.json({ exists: true, message: 'Student name already exists within the system', student: result.rows[0] });
    }

    // No matching name found anywhere
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
          <title>University Admission Slip - ${slip.slip_number}</title>
          <style>
            @page { size: A4; margin: 18mm; }
            html, body { height: 297mm; margin: 0; padding: 0; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
            .page { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 18mm; position: relative; }
            .header { text-align: center; margin-bottom: 10mm; }
            .univ { font-size: 16pt; font-weight: 700; letter-spacing: 0.5px; }
            .sub { display: none; }
            .meta { display: flex; justify-content: space-between; gap: 12mm; margin-bottom: 8mm; }
            .meta-col { flex: 1; }
            .meta-left .meta-row, .meta-right .meta-row { margin-bottom: 6px; }
            .label { font-weight: 700; font-size: 10pt; display: inline-block; width: 32mm; }
            .value { font-size: 10pt; }
            .box { border: none; padding: 8px 4px; min-height: 38mm; margin-bottom: 8mm; }
            .box-title { font-weight: 700; margin-bottom: 6px; }
            .box-content { min-height: 28mm; }
            .box-content.has-text .blank-lines { display: none; }
            .blank-lines { margin-top: 6px; }
            .blank-line { border-bottom: 1px solid #e5e7eb; height: 12px; margin: 8px 0; }
            .signatures { display: flex; justify-content: space-between; gap: 12mm; margin-top: 14mm; }
            .sig { flex: 1; text-align: center; }
            .sig-line { margin-top: 28px; border-top: 1px solid #000; width: 70%; margin-left: auto; margin-right: auto; }
            .sig-label { margin-top: 6px; font-size: 10pt; color: #374151; text-align: center; }
            .instructions { position: absolute; bottom: 18mm; left: 18mm; right: 18mm; font-size: 9.5pt; color: #374151; text-align: left; }
            .footer { position: absolute; bottom: 8mm; left: 18mm; right: 18mm; text-align: center; font-size: 9pt; color: #6b7280; }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="univ">UNIVERSITY ADMISSION SLIP</div>
            </div>

            <div class="meta">
              <div class="meta-col meta-left">
                <div class="meta-row"><span class="label">Student Name:</span><span class="value">${slip.student_name}</span></div>
                <div class="meta-row"><span class="label">Year & Section:</span><span class="value">${slip.year} - ${slip.section}</span></div>
              </div>
              <div class="meta-col meta-right" style="text-align: right;">
                <div class="meta-row"><span class="label">Slip No.:</span><span class="value">${slip.slip_number}</span></div>
                <div class="meta-row"><span class="label">Date:</span><span class="value">${new Date(slip.created_at || Date.now()).toLocaleDateString()}</span></div>
              </div>
            </div>

            <div>
              <div class="box">
                <div class="box-title">Violation Description</div>
                <div class="box-content ${(slip.violation_description || slip.description) ? 'has-text' : ''}">
                  ${ (slip.violation_description || '') + (slip.violation_description && slip.description ? '<br><br>' : '') + (slip.description || '') }
                  <div class="blank-lines">
                    <div class="blank-line"></div>
                    <div class="blank-line"></div>
                    <div class="blank-line"></div>
                    <div class="blank-line"></div>
                    <div class="blank-line"></div>
                    <div class="blank-line"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="signatures">
              <div class="sig">
                <div class="sig-line"></div>
                <div class="sig-label">Guidance Counselor</div>
                <div style="margin-top:8px; font-size:10pt; color:#374151;">(signature over printed name)</div>
              </div>
              <div class="sig">
                <div class="sig-line"></div>
                <div class="sig-label">Student</div>
                <div style="margin-top:8px; font-size:10pt; color:#374151;">(signature over printed name)</div>
              </div>
            </div>

            <div class="instructions">
              <strong>Instructions:</strong> Return this completed form to the guidance counselor.
            </div>

            <div class="footer">Generated by CounselMate System</div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
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

// Get admission slips for a specific student (paginated)
router.get('/student/:studentId/slips', async (req, res) => {
  try {
    const { studentId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 5;
    // Optional sorting: 'newest' (default) or 'oldest'
    const sort = (req.query.sort || 'newest').toString();
    // Optional status filter for server-side filtering (e.g., 'approved', 'issued', 'form_completed')
    const status = req.query.status ? req.query.status.toString() : null;
    const offset = (page - 1) * pageSize;
    // total count (optionally filtered by status)
    let countQuery = `SELECT COUNT(*) FROM admission_slips WHERE student_id = $1`;
    const countParams = [studentId];
    if (status) {
      countQuery += ` AND status = $2`;
      countParams.push(status);
    }
    const countRes = await db.query(countQuery, countParams);
    const total = parseInt(countRes.rows[0].count, 10) || 0;

    // Build ORDER BY dynamically based on requested sort
    const orderBy = sort === 'oldest' ? 'asl.created_at ASC' : 'asl.created_at DESC';

    // Build query dynamically to include status filter when provided
    const queryParts = [
      `SELECT asl.*, vt.code as violation_code, vt.description as violation_description`,
      `FROM admission_slips asl`,
      `LEFT JOIN violation_types vt ON asl.violation_type_id = vt.id`,
      `WHERE asl.student_id = $1`
    ];
    const queryParams = [studentId];
    let paramIndex = 2;
    if (status) {
      queryParts.push(`AND asl.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }
    queryParts.push(`ORDER BY ${orderBy}`);
    queryParts.push(`LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`);
    queryParams.push(pageSize, offset);

    const slipsRes = await db.query(queryParts.join('\n'), queryParams);

    res.json({ success: true, total, page, pageSize, slips: slipsRes.rows });
  } catch (error) {
    console.error('Get student slips error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete admission slip form
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { violation_type_id, description, teacher_comments, course } = req.body;

    const query = `
      UPDATE admission_slips 
      SET violation_type_id = $1, 
          description = $2, 
          teacher_comments = $3, 
          course = $4,
          status = 'form_completed',
          form_completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    // Note: adjust parameter indexes to match the query above
    const values = [violation_type_id, description, teacher_comments, course, id];
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

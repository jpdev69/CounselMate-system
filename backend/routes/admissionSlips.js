const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Your database connection
const { validateViolationMatch } = require('../utils/violationMatcher');

// Validate violation description matches violation type
router.post('/validate-violation', async (req, res) => {
  try {
    const { violation_type_id, description } = req.body;

    if (!violation_type_id || !description) {
      return res.status(400).json({
        error: 'violation_type_id and description are required'
      });
    }

    // Get the violation type details
    const violationTypeResult = await db.query(
      'SELECT code, description as type_description FROM violation_types WHERE id = $1',
      [violation_type_id]
    );

    if (violationTypeResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Violation type not found'
      });
    }

    const violationType = violationTypeResult.rows[0];
    console.log(`🔍 Validating violation: ${violationType.code} vs "${description}"`);

    // Use the LLM to validate the match
    const validation = await validateViolationMatch(violationType.code, description);

    res.json({
      success: true,
      validation: {
        matches: validation.matches,
        confidence: validation.confidence,
        reason: validation.reason,
        violation_type: violationType.code
      }
    });
  } catch (error) {
    console.error('Violation validation error:', error);
    res.status(500).json({
      error: 'Failed to validate violation'
    });
  }
});

// Issue admission slip
router.post('/issue', async (req, res) => {
  const { studentName, year, section, course, schoolYear, term, student_id, updateExistingStudent } = req.body;

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

    const slipResult = await db.query(
      `INSERT INTO admission_slips (slip_number, student_id, issued_by, status, course, school_year, term, year, section) 
       VALUES ($1, $2, $3, 'issued', $4, $5, $6, $7, $8) 
       RETURNING *`,
      [slipNumber, studentId, 'system', course || null, schoolYear || null, term || null, year || null, section || null]
    );

    try {
      await db.query(
        `INSERT INTO audit_logs (admission_slip_id, user_email, action, old_status, new_status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [slipResult.rows[0].id, 'system@school.edu', 'SLIP_ISSUED', null, 'issued']
      );
    } catch (e) {
      // Silent fail - audit log is optional
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

    // First, check whether full name (first + last tokens) already exists anywhere in the
    // `students` table regardless of year or section. If it does, treat it as a duplicate.
    // Use regex whole-word matching to avoid substring collisions (e.g., Romualdo vs Romualdez).
    // PostgreSQL supports \m and \M for start/end of word in its regex flavor.
    // When override is OFF, use master student record (authoritative source). When ON, allow editing.
    const queryNameOnly = `
      SELECT s.id, s.student_id, s.full_name, s.year, s.section, s.current_course as course
      FROM students s
      WHERE s.full_name ~* $1
        AND s.full_name ~* $2
      LIMIT 1
    `;

    // Build regex patterns that match whole words: \mWORD\M
    const valuesNameOnly = [`\\m${firstToken}\\M`, `\\m${lastToken}\\M`];

    let result;
    try {
      result = await db.query(queryNameOnly, valuesNameOnly);
    } catch (sqlErr) {
      // Silent fail - audit log cleanup is optional
      return res.status(500).json({ error: 'Database query failed during verification' });
    }

    if (result.rows.length > 0) {
      // Check if student edit override is enabled
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

      const existingStudent = result.rows[0];
      
      if (overrideEnabled) {
        // When override is enabled, only return basic student info (name, ID)
        // Don't return course/year/section to prevent auto-filling
        const basicStudentInfo = {
          id: existingStudent.id,
          student_id: existingStudent.student_id,
          full_name: existingStudent.full_name,
          // Exclude year, section, course to prevent auto-fill
        };
        
        return res.json({ 
          exists: true, 
          message: 'Student found - editing allowed due to override setting', 
          student: basicStudentInfo,
          allowEdit: true,
          overrideEnabled: true
        });
      } else {
        // Override disabled - return all existing data to show and block editing
        return res.json({ 
          exists: true, 
          message: 'Student name already exists within the system', 
          student: existingStudent,
          allowEdit: false,
          overrideEnabled: false
        });
      }
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
        asl.year,
        asl.section,
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
            body { font-family: 'Times New Roman', serif; color: #111827; }
            .page { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 18mm; position: relative; }
            
            /* University Header */
            .header { text-align: center; margin-bottom: 15mm; }
            .univ { font-size: 18pt; font-weight: 700; color: #006400; letter-spacing: 0.5px; font-family: 'Times New Roman', serif; }
            .sub { font-size: 14pt; font-weight: normal; letter-spacing: 1px; color: #333; margin: 4px 0; font-family: 'Times New Roman', serif; }
            .title { font-size: 16pt; font-weight: bold; text-decoration: underline; margin: 10px 0; font-family: 'Arial', sans-serif; }
            
            .divider { border: none; border-top: 3px double #006400; margin: 15px 0; }
            
            .meta { display: flex; justify-content: space-between; gap: 12mm; margin-bottom: 10mm; }
            .meta-col { flex: 1; }
            .meta-left .meta-row, .meta-right .meta-row { margin-bottom: 8px; }
            .label { font-weight: 700; font-size: 11pt; display: inline-block; width: 35mm; color: #333; }
            .value { font-size: 11pt; }
            
            .box { border: 1px solid #c1c1c1; padding: 10px; min-height: 40mm; margin-bottom: 10mm; background: #fff; }
            .box-title { font-weight: 700; margin-bottom: 8px; font-size: 12pt; color: #333; letter-spacing: 0.5px; }
            .box-content { min-height: 30mm; font-size: 11pt; line-height: 1.5; }
            .box-content.has-text .blank-lines { display: none; }
            .blank-lines { margin-top: 8px; }
            .blank-line { border-bottom: 1px solid #e5e7eb; height: 14px; margin: 10px 0; }
            
            .signatures { display: flex; justify-content: space-between; gap: 15mm; margin-top: 18mm; }
            .sig { flex: 1; text-align: center; }
            .sig-line { margin-top: 30px; border-top: 1px solid #000; width: 70%; margin-left: auto; margin-right: auto; }
            .sig-label { margin-top: 8px; font-size: 11pt; color: #374151; text-align: center; font-weight: 600; }
            .sig-sublabel { margin-top: 4px; font-size: 9pt; color: #6b7280; text-align: center; }
            
            .instructions { position: absolute; bottom: 20mm; left: 18mm; right: 18mm; font-size: 10pt; color: #374151; text-align: left; font-style: italic; }
            .footer { position: absolute; bottom: 10mm; left: 18mm; right: 18mm; text-align: center; font-size: 9pt; color: #6b7280; font-family: 'Arial', sans-serif; }
            
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="univ">ISABELA STATE UNIVERSITY</div>
              <div class="sub">GUIDANCE OFFICE</div>
              <div class="title">ADMISSION SLIP</div>
            </div>

            <div class="divider"></div>

            <div class="meta">
              <div class="meta-col meta-left">
                <div class="meta-row"><span class="label">Student Name:</span><span class="value">${slip.student_name}</span></div>
                <div class="meta-row"><span class="label">Course:</span><span class="value">${slip.course || '—'}</span></div>
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
                <div class="sig-sublabel">(Signature over printed name)</div>
              </div>
              <div class="sig">
                <div class="sig-line"></div>
                <div class="sig-label">Student</div>
                <div class="sig-sublabel">(Signature over printed name)</div>
              </div>
            </div>

            <div class="instructions">
              <strong>Instructions:</strong> Return this completed form to the guidance counselor.
            </div>

            <div class="footer">Generated by GuidanceOS</div>
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
        vt.description as violation_description,
        vt.category as violation_category
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
      `SELECT asl.*, vt.code as violation_code, vt.description as violation_description, vt.category as violation_category`,
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
    const { violation_type_id, description, teacher_comments, course, school_year, term, skip_validation } = req.body;

    console.log(`📋 Completing form for slip ${id} with violation type ${violation_type_id}`);

    // Only run server-side validation when the frontend hasn't already flagged a user override
    if (!skip_validation) {
      // Look up the violation type code (string) — validateViolationMatch needs the code, not the numeric id
      const vtResult = await db.query(
        'SELECT code FROM violation_types WHERE id = $1',
        [violation_type_id]
      );
      if (vtResult.rows.length === 0) {
        return res.status(404).json({ error: 'Violation type not found' });
      }
      const violationTypeCode = vtResult.rows[0].code;

      const validation = await validateViolationMatch(violationTypeCode, description);
      
      if (!validation.matches) {
        return res.status(400).json({
          error: 'Violation description does not match the selected violation type',
          validation: {
            matches: false,
            confidence: validation.confidence,
            reason: validation.reason
          }
        });
      }
    } else {
      console.log('⚠️ Skipping server-side validation (user chose to proceed anyway)');
    }

    const query = `
      UPDATE admission_slips 
      SET violation_type_id = $1, 
          description = $2, 
          teacher_comments = $3, 
          course = $4,
          school_year = $5,
          term = $6,
          status = 'form_completed',
          form_completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;
    // Note: adjust parameter indexes to match the query above
    const values = [violation_type_id, description, teacher_comments, course, school_year, term, id];
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
      // Silent fail - audit log is optional
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
      // Silent fail - audit log is optional
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

// Delete admission slip (only allowed for 'issued' and 'form_completed' statuses)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate input
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Invalid admission slip id' });
    }

    // Find the slip first
    const slipRes = await db.query(`SELECT id, status FROM admission_slips WHERE id = $1`, [id]);
    if (slipRes.rows.length === 0) return res.status(404).json({ error: 'Admission slip not found' });

    const slip = slipRes.rows[0];

    // Only allow deletion of issued and form_completed slips
    if (!['issued', 'form_completed'].includes(slip.status)) {
      return res.status(403).json({ error: 'Cannot delete this admission slip. Only slips with status "issued" or "form_completed" can be deleted.' });
    }

    // Proceed to delete the slip. To avoid foreign key violations, delete
    // any audit logs referencing it first. Wrap in a transaction for safety.
    try {
      // Use a dedicated client for transaction
      let deletedSlip = null;
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        // delete audit logs that reference this slip (best-effort). If audit_logs
        // table doesn't exist, continue with delete of the slip.
        try {
          await client.query('DELETE FROM audit_logs WHERE admission_slip_id = $1', [id]);
        } catch (audErr) {
          // Silent fail - audit log cleanup is optional
        }
        const deleteRes = await client.query('DELETE FROM admission_slips WHERE id = $1 RETURNING *', [id]);
        if (deleteRes.rows.length === 0) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(404).json({ error: 'Admission slip not found' });
        }
        deletedSlip = deleteRes.rows[0];
        await client.query('COMMIT');
        client.release();
      } catch (clientErr) {
        try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
        client.release();
        throw clientErr;
      }
      // Return the deleted slip to caller
      return res.json({ success: true, message: 'Admission slip deleted successfully', slip: deletedSlip });

      // NOTE: We intentionally do not insert a new audit_log after deletion since the
      // `admission_slip_id` foreign key would reference a deleted slip. If you prefer
      // preserving deletion events, we can add a separate audit table or make the
      // `admission_slip_id` nullable and set it to NULL on delete.
    } catch (txErr) {
      console.error('Delete slip transaction error:', txErr);
      // Foreign key constraint violation from other tables
      if (txErr.code === '23503') {
        return res.status(409).json({ error: 'Cannot delete admission slip: referenced by other records', detail: txErr.detail });
      }
      return res.status(500).json({ error: 'Failed to delete admission slip' });
    }
  } catch (error) {
    console.error('Delete slip error:', error);
    res.status(500).json({ error: 'Failed to delete admission slip' });
  }
});

module.exports = router;

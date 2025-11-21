// THIS MUST BE AT THE VERY TOP OF THE FILE
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Use environment variables
const PORT = process.env.PORT;
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const DATABASE_URL = process.env.DATABASE_URL;

// Configure CORS with the environment variable
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true
}));

app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: DATABASE_URL,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CounselMate Backend Running',
    database: DATABASE_URL ? 'Configured' : 'Not configured',
    cors: CORS_ORIGIN
  });
});

// AUTHENTICATION ROUTES

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Only allow counselor@university.edu
    if (email !== 'counselor@university.edu') {
      return res.status(401).json({ 
        success: false,
        error: 'Login Failed. You must be a guidance counselor.' 
      });
    }

    // Get user from database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    const user = userResult.rows[0];

    // Check password (in production, you should use bcrypt for hashing)
    if (password !== user.password_hash) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password' 
      });
    }

    // Return user data (without password)
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role
    };

    // Simple token (in production, use JWT)
    const token = 'simple-token-' + Date.now();

    res.json({
      success: true,
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Change password endpoint
app.put('/api/auth/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const email = 'counselor@university.edu'; // Only user for now

    // Get current user data
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const user = userResult.rows[0];

    // Verify current password
    if (currentPassword !== user.password_hash) {
      return res.status(400).json({ 
        success: false,
        error: 'Current password is incorrect' 
      });
    }

    // Update password in database
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
      [newPassword, email]
    );

    console.log('Password changed successfully for:', email);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to change password' 
    });
  }
});

// ... (keep all your other routes the same)
// API route to get violation types
app.get('/api/violation-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM violation_types ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API route to issue admission slip
app.post('/api/admission-slips/issue', async (req, res) => {
  const { studentName, year, section } = req.body;
  
  try {
    // Generate slip number
    const slipNumber = `SLIP-${Date.now()}`;
    
    // Insert into students table
    const studentResult = await pool.query(
      `INSERT INTO students (student_id, full_name, year, section) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [`STU-${Date.now()}`, studentName, year, section]
    );
    
    const studentId = studentResult.rows[0].id;
    
    // Insert into admission_slips table
    const slipResult = await pool.query(
      `INSERT INTO admission_slips (slip_number, student_id, issued_by, status) 
       VALUES ($1, $2, $3, 'issued') 
       RETURNING *`,
      [slipNumber, studentId, 'system']
    );
    
    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (admission_slip_id, user_email, action, old_status, new_status) 
       VALUES ($1, $2, $3, $4, $5)`,
      [slipResult.rows[0].id, 'system@school.edu', 'SLIP_ISSUED', null, 'issued']
    );
    
    res.json({ 
      success: true, 
      slip: slipResult.rows[0],
      message: 'Admission slip issued successfully'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ADDED HEREBY!!!!!

// API route to complete admission slip form
app.put('/api/admission-slips/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { violation_type_id, description, teacher_comments } = req.body;

    console.log('Completing form for slip:', id, req.body);

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
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admission slip not found' });
    }

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (admission_slip_id, user_email, action, old_status, new_status) 
       VALUES ($1, $2, $3, $4, $5)`,
      [id, 'counselor@university.edu', 'FORM_COMPLETED', 'issued', 'form_completed']
    );

    res.json({ 
      success: true, 
      slip: result.rows[0],
      message: 'Form completed successfully'
    });

  } catch (error) {
    console.error('Complete form error:', error);
    res.status(500).json({ 
      error: 'Failed to complete form: ' + error.message 
    });
  }
});

// API route to approve admission slip
app.put('/api/admission-slips/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Approving slip:', id);

    const query = `
      UPDATE admission_slips 
      SET status = 'approved',
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admission slip not found' });
    }

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (admission_slip_id, user_email, action, old_status, new_status) 
       VALUES ($1, $2, $3, $4, $5)`,
      [id, 'counselor@university.edu', 'SLIP_APPROVED', 'form_completed', 'approved']
    );

    res.json({ 
      success: true, 
      slip: result.rows[0],
      message: 'Slip approved successfully'
    });

  } catch (error) {
    console.error('Approve slip error:', error);
    res.status(500).json({ 
      error: 'Failed to approve slip: ' + error.message 
    });
  }
});

// noicenoicenoicenoice

// API route to get all admission slips
app.get('/api/admission-slips', async (req, res) => {
  try {
    const result = await pool.query(`
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
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
  console.log(`🌐 CORS enabled for: ${CORS_ORIGIN}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
});
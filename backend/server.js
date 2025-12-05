// THIS MUST BE AT THE VERY TOP OF THE FILE
require('dotenv').config();

const express = require('express');
const cors = require('cors');
// shared DB pool is in ./config/database.js

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

// Validate incoming string inputs across body, query and params (max 32 chars)
const validateInput = require('./middleware/validateInput');
app.use(validateInput);

// Database pool (created in config/database.js)
const pool = require('./config/database');

// Ensure security columns exist (safe to call repeatedly)
async function ensureSecurityColumns() {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS security_question VARCHAR(256);");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer VARCHAR(256);");
  } catch (err) {
    // Non-fatal: log and continue — queries below will surface errors if necessary
    console.warn('ensureSecurityColumns warning:', err.message || err);
  }
}

// Test database connection (best-effort)
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

    // Ensure both passwords are provided
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Both current and new passwords are required'
      });
    }

    // Verify current password
    if (currentPassword !== user.password_hash) {
      return res.status(400).json({ 
        success: false,
        error: 'Current password is incorrect' 
      });
    }

    // Validate new password: require at least one letter and one number (allow special characters)
    const requireLetterAndDigit = /(?=.*[A-Za-z])(?=.*\d)/;
    if (!requireLetterAndDigit.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'New password must include at least one letter and one number'
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
// Mount router for admission slips (consolidated routes in router module)
const admissionSlipsRouter = require('./routes/admissionSlips');
app.use('/api/admission-slips', admissionSlipsRouter);

// Get current user's saved security question (for counselor user)
app.get('/api/auth/me/security-question', async (req, res) => {
  try {
    await ensureSecurityColumns();
    const email = 'counselor@university.edu';
    const userResult = await pool.query('SELECT security_question FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, securityQuestion: userResult.rows[0].security_question || null });
  } catch (err) {
    console.error('Get my security question error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to get security question' });
  }
});

// Update current user's security question and answer (for counselor user)
app.put('/api/auth/me/security-question', async (req, res) => {
  try {
    const { security_question, security_answer } = req.body || {};
    if (!security_question || !security_answer) return res.status(400).json({ success: false, error: 'security_question and security_answer are required' });
    const email = 'counselor@university.edu';
    // Ensure columns exist before updating
    await ensureSecurityColumns();
    // In production, security answers should be hashed and stored securely
    await pool.query('UPDATE users SET security_question = $1, security_answer = $2, updated_at = CURRENT_TIMESTAMP WHERE email = $3', [security_question, security_answer, email]);
    return res.json({ success: true, message: 'Security question saved' });
  } catch (err) {
    console.error('Update my security question error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to update security question' });
  }
});

// Debug endpoint: check database connectivity and simple students count
app.get('/api/debug/db', async (req, res) => {
  try {
    // Simple ping
    const ping = await pool.query('SELECT 1 as ok');
    // Try to get students count if table exists
    let studentsCount = null;
    try {
      const c = await pool.query('SELECT count(*) as cnt FROM students');
      studentsCount = parseInt(c.rows[0].cnt, 10);
    } catch (innerErr) {
      // table might not exist; include message but don't fail the ping
      console.warn('Debug students count error:', innerErr.message || innerErr);
      studentsCount = null;
    }

    return res.json({
      db_connected: !!ping.rows,
      students_count: studentsCount
    });
  } catch (err) {
    console.error('DB debug endpoint error:', err.message || err);
    return res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
  console.log(`🌐 CORS enabled for: ${CORS_ORIGIN}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
});

// Forgot password - return the counselor's saved security question (no email required)
app.get('/api/auth/forgot', async (req, res) => {
  try {
    const email = 'counselor@university.edu';
    const userResult = await pool.query('SELECT security_question FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, securityQuestion: userResult.rows[0].security_question || null });
  } catch (err) {
    console.error('Forgot password (get) error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve security question' });
  }
});

// Forgot password - verify provided answer against saved counselor answer and reset password
app.post('/api/auth/forgot/reset', async (req, res) => {
  const { answer, newPassword } = req.body || {};
  if (!answer || !newPassword) return res.status(400).json({ success: false, error: 'Answer and newPassword are required' });

  try {
    const email = 'counselor@university.edu';
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid answer' });
    }

    const user = userResult.rows[0];

    // In production, security answers should be hashed; this app stores plaintext for demo
    if ((user.security_answer || '').toString().trim().toLowerCase() !== (answer || '').toString().trim().toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Invalid answer' });
    }

    const requireLetterAndDigit = /(?=.*[A-Za-z])(?=.*\d)/;
    if (!requireLetterAndDigit.test(newPassword)) {
      return res.status(400).json({ success: false, error: 'New password must include at least one letter and one number' });
    }

    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2', [newPassword, email]);
    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('Forgot password (reset) error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// Forgot password - verify provided answer only (does not change password)
app.post('/api/auth/forgot/verify', async (req, res) => {
  const { answer } = req.body || {};
  if (!answer) return res.status(400).json({ success: false, error: 'Answer is required' });

  try {
    const email = 'counselor@university.edu';
    const userResult = await pool.query('SELECT security_answer FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid answer' });
    }

    const saved = (userResult.rows[0].security_answer || '').toString().trim().toLowerCase();
    if (saved !== (answer || '').toString().trim().toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Invalid answer' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Forgot password (verify) error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to verify answer' });
  }
});
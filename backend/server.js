// THIS MUST BE AT THE VERY TOP OF THE FILE
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { authenticate } = require('./middleware/auth');
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

// Ensure student_reports table and Student Manual violation types exist
async function ensureStudentReportsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_reports (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id),
        violation_type_id INTEGER REFERENCES violation_types(id),
        description TEXT,
        remarks TEXT,
        course VARCHAR(256),
        status VARCHAR(32) DEFAULT 'reported',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.warn('ensureStudentReportsTable warning:', err.message || err);
  }
}

async function ensureViolationTypeCategory() {
  try {
    await pool.query("ALTER TABLE violation_types ADD COLUMN IF NOT EXISTS category VARCHAR(32);");
    await pool.query("ALTER TABLE violation_types ADD COLUMN IF NOT EXISTS section_ref VARCHAR(16);");
    await pool.query("ALTER TABLE violation_types ADD COLUMN IF NOT EXISTS requires_admission_slip BOOLEAN NOT NULL DEFAULT false;");
    // Widen code column if it is still the old VARCHAR(50)
    await pool.query("ALTER TABLE violation_types ALTER COLUMN code TYPE VARCHAR(128);");
    // Ensure unique constraint on code so ON CONFLICT (code) works in the upsert
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'violation_types_code_key'
            AND conrelid = 'violation_types'::regclass
        ) THEN
          ALTER TABLE violation_types ADD CONSTRAINT violation_types_code_key UNIQUE (code);
        END IF;
      END $$;
    `);
  } catch (err) {
    console.warn('ensureViolationTypeCategory warning:', err.message || err);
  }
}

async function seedStudentManualViolationTypes() {
  try {
    await ensureViolationTypeCategory();
    // Only seed if the table is completely empty — skip if admin has already managed violations
    const existing = await pool.query('SELECT 1 FROM violation_types LIMIT 1');
    if (existing.rows.length > 0) return;
    const manualTypes = [
      // Minor Offenses (Section 2.1)
      { code: 'IMPROPER_UNIFORM', description: 'Failure to wear proper/complete uniform', category: 'minor', section_ref: '2.1.1' },
      { code: 'PORNOGRAPHIC_MATERIALS', description: 'Possession and passing of pornographic materials', category: 'minor', section_ref: '2.1.2' },
      { code: 'LITTERING', description: 'Littering/unsanitary acts', category: 'minor', section_ref: '2.1.3' },
      { code: 'LOITERING', description: 'Loitering', category: 'minor', section_ref: '2.1.4' },
      { code: 'EATING_RESTRICTED_AREAS', description: 'Eating in restricted areas (library, laboratories)', category: 'minor', section_ref: '2.1.5' },
      { code: 'UNAUTHORIZED_FACILITY_USE', description: 'Unauthorized use of school facilities', category: 'minor', section_ref: '2.1.6' },
      { code: 'ID_LENDING_BORROWING', description: 'Lending/borrowing of Identification Card', category: 'minor', section_ref: '2.1.7' },
      { code: 'TRAFFIC_VIOLATIONS', description: 'Driving without license/unregistered vehicle/traffic violations inside campus', category: 'minor', section_ref: '2.1.8' },
      // Major Offenses (Section 2.2)
      { code: 'DRUGS_ALCOHOL_WEAPONS', description: 'Possession/use of alcoholic drinks, prohibited drugs, weapons or explosives', category: 'major', section_ref: '2.2.1' },
      { code: 'SMOKING', description: 'Smoking', category: 'major', section_ref: '2.2.2' },
      { code: 'DISRESPECT', description: 'Disrespect', category: 'major', section_ref: '2.2.3' },
      { code: 'VANDALISM', description: 'Vandalism in all areas/facility of the campus', category: 'major', section_ref: '2.2.4' },
      { code: 'DISHONESTY_CHEATING_FORGERY', description: 'Dishonesty/cheating/forgery/falsification', category: 'major', section_ref: '2.2.5' },
      { code: 'CREATING_BARRICADES', description: 'Creating barricades/obstructions', category: 'major', section_ref: '2.2.6' },
      { code: 'ASSAULT_VERBAL_ABUSE', description: 'Assaults/physical injuries/verbal abuse (oral, social media, text)', category: 'major', section_ref: '2.2.7' },
      { code: 'HAZING', description: 'Hazing', category: 'major', section_ref: '2.2.8' },
      { code: 'HARASSMENT_SEXUAL_ABUSE', description: 'Harassment and sexual abuse/acts of lasciviousness', category: 'major', section_ref: '2.2.9' },
      { code: 'UNAUTHORIZED_SOFTWARE_GADGETS', description: 'Use of unauthorized software and electronic gadgets', category: 'major', section_ref: '2.2.10' },
      { code: 'UNRECOGNIZED_FRATERNITY_SORORITY', description: 'Involvement in unrecognized sorority/fraternity', category: 'major', section_ref: '2.2.11' },
      { code: 'GAMBLING', description: 'Gambling', category: 'major', section_ref: '2.2.12' },
      { code: 'PDA_IMMORAL_ACTS', description: 'Public display of affection/intimacy, indecent or immoral acts', category: 'major', section_ref: '2.2.13' },
      { code: 'OFFENSIVE_SUBVERSIVE_MATERIALS', description: 'Possession and distribution of offensive/subversive materials', category: 'major', section_ref: '2.2.14' },
      { code: 'GRAVE_THREATS', description: 'Grave threats', category: 'major', section_ref: '2.2.15' },
      { code: 'INCITING_FIGHT_SEDITION', description: 'Inciting to fight/sedition', category: 'major', section_ref: '2.2.16' },
      { code: 'UNAUTHORIZED_ACTIVITY', description: 'Conducting unauthorized activity/misrepresenting the University', category: 'major', section_ref: '2.2.17' },
      { code: 'BULLYING', description: 'Bullying', category: 'major', section_ref: '2.2.18' },
    ];

    for (const vt of manualTypes) {
      // Upsert: insert if missing, update description/category/section_ref if already present
      await pool.query(
        `INSERT INTO violation_types (code, description, category, section_ref)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
           SET description  = EXCLUDED.description,
               category     = EXCLUDED.category,
               section_ref  = EXCLUDED.section_ref`,
        [vt.code, vt.description, vt.category, vt.section_ref]
      );
    }
  } catch (err) {
    console.warn('seedStudentManualViolationTypes warning:', err.message || err);
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
    message: 'GuidanceOS Backend Running',
    database: DATABASE_URL ? 'Configured' : 'Not configured',
    cors: CORS_ORIGIN
  });
});

// AUTHENTICATION ROUTES

// Rate limiter middleware for auth
const { precheckRateLimit, recordFailedAttempt, clearAttempts } = require('./middleware/rateLimiter');

// Login endpoint
app.post('/api/auth/login', precheckRateLimit('login'), async (req, res) => {
  const { email, password } = req.body;

  try {
    // Only allow counselor@university.edu
    if (email !== 'counselor@university.edu') {
      // Record failed login for invalid email
      try { recordFailedAttempt(req, 'login'); } catch (e) { /* no-op */ }
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password. Please check your credentials and try again.'
      });
    }

    // Get user from database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      // Record failed attempt when user not found
      try { recordFailedAttempt(req, 'login'); } catch (e) { /* no-op */ }
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    const user = userResult.rows[0];

    // Check password (in production, you should use bcrypt for hashing)
    if (password !== user.password_hash) {
      // Increment failed attempt count
      try { recordFailedAttempt(req, 'login'); } catch (e) { /* no-op */ }
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // Return user data (without password)
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role
    };

    // Sign a JWT with user info (expires in 30 minutes)
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    // Clear attempts on successful login
    try { clearAttempts(req, 'login'); } catch (e) { /* no-op */ }
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
app.put('/api/auth/change-password', authenticate, async (req, res) => {
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

// API route to get violation types (supports ?category=minor|major filter)
app.get('/api/violation-types', authenticate, async (req, res) => {
  try {
    const category = req.query.category;
    let query = 'SELECT * FROM violation_types WHERE section_ref IS NOT NULL';
    const params = [];
    if (category && ['minor', 'major'].includes(category)) {
      query += ' AND category = $1';
      params.push(category);
    }
    query += ' ORDER BY section_ref, id';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Mount router for admission slips (consolidated routes in router module)
const admissionSlipsRouter = require('./routes/admissionSlips');
app.use('/api/admission-slips', authenticate, admissionSlipsRouter);

// Mount router for student reports (violations without admission slips)
const reportsRouter = require('./routes/reports');
app.use('/api/reports', authenticate, reportsRouter);

// Mount router for visualizations and analytics
const visualizationsRouter = require('./routes/visualizations');
app.use('/api/visualizations', authenticate, visualizationsRouter);

// Mount router for chatbot (Student Manual violation assistant)
const chatbotRouter = require('./routes/chatbot');
app.use('/api/chatbot', authenticate, chatbotRouter);

// Mount admin router (courses, year levels, sections management)
const adminRouter = require('./routes/admin');
app.use('/api/admin', authenticate, adminRouter);

// Get current user's saved security question (for counselor user)
app.get('/api/auth/me/security-question', authenticate, precheckRateLimit('me-security-question'), async (req, res) => {
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
app.put('/api/auth/me/security-question', authenticate, precheckRateLimit('me-security-question'), async (req, res) => {
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

// Run DB migrations on startup, then start server
(async () => {
  try {
    await ensureStudentReportsTable();
    await seedStudentManualViolationTypes();
  } catch (err) {
    console.warn('Startup migration warning:', err.message || err);
  }
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
    console.log(`🌐 CORS enabled for: ${CORS_ORIGIN}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  });
})();

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
app.post('/api/auth/forgot/reset', precheckRateLimit('forgot-reset'), async (req, res) => {
  const { answer, newPassword } = req.body || {};
  if (!answer || !newPassword) return res.status(400).json({ success: false, error: 'Answer and newPassword are required' });

  try {
    const email = 'counselor@university.edu';
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      try { recordFailedAttempt(req, 'forgot-reset'); } catch (e) { /* no-op */ }
      return res.status(400).json({ success: false, error: 'Invalid answer' });
    }

    const user = userResult.rows[0];

    // In production, security answers should be hashed; this app stores plaintext for demo
    if ((user.security_answer || '').toString().trim().toLowerCase() !== (answer || '').toString().trim().toLowerCase()) {
      try { recordFailedAttempt(req, 'forgot-reset'); } catch (e) { /* no-op */ }
      return res.status(400).json({ success: false, error: 'Invalid answer' });
    }

    const requireLetterAndDigit = /(?=.*[A-Za-z])(?=.*\d)/;
    if (!requireLetterAndDigit.test(newPassword)) {
      return res.status(400).json({ success: false, error: 'New password must include at least one letter and one number' });
    }

    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2', [newPassword, email]);
    // Clear attempts when the answer is correct and reset occurs
    try { clearAttempts(req, 'forgot-reset'); } catch (e) { /* no-op */ }
    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('Forgot password (reset) error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// Forgot password - verify provided answer only (does not change password)
// Rate limit attempts to verify security question answer
app.post('/api/auth/forgot/verify', precheckRateLimit('forgot-verify'), async (req, res) => {
  const { answer } = req.body || {};
  if (!answer) return res.status(400).json({ success: false, error: 'Answer is required' });

  try {
    const email = 'counselor@university.edu';
    const userResult = await pool.query('SELECT security_answer FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      try { recordFailedAttempt(req, 'forgot-verify'); } catch (e) { /* no-op */ }
      return res.status(400).json({ success: false, error: 'Invalid answer' });
    }

    const saved = (userResult.rows[0].security_answer || '').toString().trim().toLowerCase();
    if (saved !== (answer || '').toString().trim().toLowerCase()) {
      try { recordFailedAttempt(req, 'forgot-verify'); } catch (e) { /* no-op */ }
      return res.status(400).json({ success: false, error: 'Invalid answer' });
    }

    // Success - clear attempts
    try { clearAttempts(req, 'forgot-verify'); } catch (e) { /* no-op */ }
    return res.json({ success: true });
  } catch (err) {
    console.error('Forgot password (verify) error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to verify answer' });
  }
});
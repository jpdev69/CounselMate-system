// THIS MUST BE AT THE VERY TOP OF THE FILE
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { authenticate } = require('./middleware/auth');

// In-memory OTP store: { otp, expiresAt, verified }
// Single-entry keyed by a fixed key since there is only one counselor account.
const otpStore = new Map();
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

// Ensure recovery_email column exists (safe to call repeatedly)
async function ensureRecoveryEmailColumn() {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(256);");
  } catch (err) {
    console.warn('ensureRecoveryEmailColumn warning:', err.message || err);
  }
}

// Ensure admission_slips table has school year and term columns
async function ensureAdmissionSlipsColumns() {
  try {
    await pool.query("ALTER TABLE admission_slips ADD COLUMN IF NOT EXISTS school_year VARCHAR(9);");
    await pool.query("ALTER TABLE admission_slips ADD COLUMN IF NOT EXISTS term VARCHAR(10);");
  } catch (err) {
    console.warn('ensureAdmissionSlipsColumns warning:', err.message || err);
  }
}

// Ensure admin user has correct role
async function ensureAdminRole() {
  try {
    const result = await pool.query('SELECT role FROM users WHERE email = $1', ['admin@university.edu']);
    if (result.rows.length > 0 && result.rows[0].role !== 'admin') {
      await pool.query('UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2', ['admin', 'admin@university.edu']);
    }
  } catch (err) {
    console.warn('ensureAdminRole warning:', err.message || err);
  }
}

// Ensure signup_requests table exists
async function ensureSignupRequestsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signup_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(256) UNIQUE NOT NULL,
        full_name VARCHAR(256) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
      } catch (err) {
    console.warn('ensureSignupRequestsTable warning:', err.message || err);
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
        school_year VARCHAR(9),
        term VARCHAR(10),
        status VARCHAR(32) DEFAULT 'reported',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add school_year and term columns if they don't exist
    await pool.query("ALTER TABLE student_reports ADD COLUMN IF NOT EXISTS school_year VARCHAR(9);");
    await pool.query("ALTER TABLE student_reports ADD COLUMN IF NOT EXISTS term VARCHAR(10);");
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

// Signup request endpoint - allows Gmail users to request access
app.post('/api/auth/signup-request', async (req, res) => {
  const { email, fullName, reason } = req.body;

  try {
    // Validate required fields
    if (!email || !fullName || !reason) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: email, full name, and reason for access'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address'
      });
    }

    // Only allow Gmail addresses
    if (!email.trim().toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({
        success: false,
        error: 'Only Gmail addresses are allowed for signup requests'
      });
    }

    // Check if email already exists in users table
    const existingUser = await pool.query(
      'SELECT email FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'This email is already registered in the system'
      });
    }

    // Check if there's already any signup request with this email (regardless of status)
    const existingRequest = await pool.query(
      'SELECT email, status FROM signup_requests WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (existingRequest.rows.length > 0) {
      const existingStatus = existingRequest.rows[0].status;
      if (existingStatus === 'pending') {
        return res.status(409).json({
          success: false,
          error: 'A signup request for this email is already pending'
        });
      } else {
        // For approved/rejected requests, check if user account exists
        // If user was deleted, allow resubmission by cleaning up the old request
        if (existingStatus === 'approved') {
          const userExists = await pool.query(
            'SELECT email FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
          );
          
          if (userExists.rows.length === 0) {
            // User was deleted, clean up the old signup request and allow resubmission
            await pool.query('DELETE FROM signup_requests WHERE email = $1', [email.trim().toLowerCase()]);
            console.log(`Cleaned up old approved signup request for deleted user: ${email}`);
          } else {
            return res.status(409).json({
              success: false,
              error: 'This email is already registered in the system'
            });
          }
        } else {
          // For rejected requests, allow resubmission by cleaning up the old request
          await pool.query('DELETE FROM signup_requests WHERE email = $1', [email.trim().toLowerCase()]);
          console.log(`Cleaned up old rejected signup request: ${email}`);
        }
      }
    }

    // Ensure signup_requests table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS signup_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(256) UNIQUE NOT NULL,
        full_name VARCHAR(256) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert signup request
    await pool.query(
      'INSERT INTO signup_requests (email, full_name, reason) VALUES ($1, $2, $3)',
      [email.trim().toLowerCase(), fullName.trim(), reason.trim()]
    );

    console.log(`New signup request from: ${email} (${fullName})`);

    return res.json({
      success: true,
      message: 'Signup request submitted successfully. Your request will be reviewed by the administrator.'
    });

  } catch (error) {
    console.error('Signup request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit signup request'
    });
  }
});

// Get all users (admin only)
app.get('/api/admin/users', authenticate, async (req, res) => {
  try {
    // Only allow admin to view users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const result = await pool.query(
      'SELECT id, email, full_name, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );

    return res.json({
      success: true,
      users: result.rows // Use roles from database, don't override them
    });

  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
});

// Delete user account (admin only)
app.delete('/api/admin/users/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    // Only allow admin to delete users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    // Get the user to delete
    const userResult = await pool.query(
      'SELECT email, role FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Prevent deleting the main admin account
    if (user.email === 'admin@university.edu') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the main administrator account'
      });
    }

    // Delete the user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    console.log(`User account deleted: ${user.email} (${user.full_name || 'N/A'})`);

    return res.json({
      success: true,
      message: `User account for ${user.email} has been deleted successfully`
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete user account'
    });
  }
});

// Update user password (admin only)
app.put('/api/admin/users/:id/reset-password', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    // Only allow admin to reset passwords
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    // Get the user
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Reset password to default
    const defaultPassword = 'changeme123';
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [defaultPassword, id]
    );

    console.log(`Password reset for user ID: ${id}`);

    return res.json({
      success: true,
      message: 'Password has been reset to the default value'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

// Get all signup requests (admin only)
app.get('/api/admin/signup-requests', authenticate, async (req, res) => {
  try {
    // Only allow admin to view signup requests
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    const result = await pool.query(
      'SELECT * FROM signup_requests ORDER BY created_at DESC'
    );

    return res.json({
      success: true,
      requests: result.rows
    });

  } catch (error) {
    console.error('Get signup requests error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve signup requests'
    });
  }
});

// Update signup request status (admin only)
app.put('/api/admin/signup-requests/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Only allow admin to update signup requests
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be either "approved" or "rejected"'
      });
    }

    // Get the signup request
    const requestResult = await pool.query(
      'SELECT * FROM signup_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Signup request not found'
      });
    }

    const request = requestResult.rows[0];

    // Update request status
    await pool.query(
      'UPDATE signup_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, id]
    );

    // If approved, create user account
    if (status === 'approved') {
      // Check if user already exists (double-check)
      const existingUser = await pool.query(
        'SELECT email FROM users WHERE email = $1',
        [request.email]
      );

      if (existingUser.rows.length === 0) {
        // Create new user with default password (they'll need to reset it)
        const defaultPassword = 'changeme123';
        await pool.query(
          'INSERT INTO users (email, full_name, password_hash, role) VALUES ($1, $2, $3, $4)',
          [request.email, request.full_name, defaultPassword, 'counselor']
        );

        console.log(`Created new user account for: ${request.email}`);
      }
    }

    console.log(`Signup request ${id} ${status} for email: ${request.email}`);

    return res.json({
      success: true,
      message: `Signup request ${status} successfully`
    });

  } catch (error) {
    console.error('Update signup request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update signup request'
    });
  }
});

// Delete signup request (admin only)
app.delete('/api/admin/signup-requests/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    // Only allow admin to delete signup requests
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }

    // Get the signup request to delete
    const requestResult = await pool.query(
      'SELECT * FROM signup_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Signup request not found'
      });
    }

    const request = requestResult.rows[0];

    // Delete the signup request
    await pool.query('DELETE FROM signup_requests WHERE id = $1', [id]);

    console.log(`Signup request deleted: ${request.email} (${request.full_name})`);

    return res.json({
      success: true,
      message: `Signup request for ${request.email} has been deleted successfully`
    });

  } catch (error) {
    console.error('Delete signup request error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete signup request'
    });
  }
});

// Test database connection (best-effort)
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('Database connected successfully');
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
const { precheckRateLimit, recordFailedAttempt, clearAttempts, setOtpCooldown, getOtpCooldown } = require('./middleware/rateLimiter');

// Login endpoint

app.post('/api/auth/login', precheckRateLimit('login'), async (req, res) => {
  const { email, password } = req.body;

  try {

    // Require both email and password fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required.'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required.'
      });
    }

    // Get user from database
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );


    if (userResult.rows.length === 0) {
      // Record failed attempt when user not found
      const attemptInfo = recordFailedAttempt(req, 'login');
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password. Please check your credentials and try again.',
        remainingAttempts: attemptInfo.remainingAttempts
      });
    }

    const user = userResult.rows[0];

    // Check password (in production, you should use bcrypt for hashing)
    if (password !== user.password_hash) {
      // Increment failed attempt count
      const attemptInfo = recordFailedAttempt(req, 'login');
      return res.status(401).json({ 
        success: false,
        error: 'Invalid email or password. Please check your credentials and try again.',
        remainingAttempts: attemptInfo.remainingAttempts
      });
    }

    // Return user data (without password)
    // Ensure admin@university.edu always has admin role
    const userRole = user.email === 'admin@university.edu' ? 'admin' : user.role;
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: userRole
    };

    // Sign a JWT with user info (expires in 30 minutes)
    const token = jwt.sign(
      { id: user.id, email: user.email, role: userRole },
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

// POST /api/auth/verify-current-password
// Verifies the current password for accessing sensitive settings
app.post('/api/auth/verify-current-password', authenticate, precheckRateLimit('verify-password'), async (req, res) => {
  const { currentPassword } = req.body || {};
  
  if (!currentPassword) {
    return res.status(400).json({ success: false, error: 'Current password is required' });
  }

  try {
    // Get current user from authenticated token
    const email = req.user.email;

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
      const attemptInfo = recordFailedAttempt(req, 'verify-password');
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid password',
        remainingAttempts: attemptInfo.remainingAttempts
      });
    }

    // Clear attempts on successful verification
    try { clearAttempts(req, 'verify-password'); } catch (e) { /* no-op */ }
    return res.json({ success: true, message: 'Password verified successfully' });

  } catch (error) {
    console.error('Verify password error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to verify password' 
    });
  }
});

// Change password endpoint
app.put('/api/auth/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // Get current user from authenticated token
    const email = req.user.email;

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

    // Validate new password
    const requireLetterAndDigit = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
    if (!requireLetterAndDigit.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: 'New password must include at least one letter and one number, one uppercase letter, and one special character'
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
const adminRouter = require('./routes/admin');
app.use('/api/admin', authenticate, adminRouter);

// GET /api/auth/me/gmail-settings — returns Gmail readiness + recovery email
app.get('/api/auth/me/gmail-settings', authenticate, async (req, res) => {
  try {
    const email = req.user.email;
    const result = await pool.query('SELECT recovery_email FROM users WHERE email = $1', [email]);
    const dbRecoveryEmail = result.rows[0]?.recovery_email || null;
    const gmailUser = process.env.GMAIL_USER;
    const gmailReady = !!(gmailUser && process.env.GMAIL_APP_PASSWORD && gmailUser !== 'your_gmail@gmail.com');
    const fallbackEmail = process.env.RECOVERY_EMAIL || gmailUser || null;
    return res.json({
      success: true,
      gmailReady,
      gmailUser: gmailReady ? gmailUser : null,
      recoveryEmail: dbRecoveryEmail || fallbackEmail || null,
      usingEnvFallback: !dbRecoveryEmail
    });
  } catch (err) {
    console.error('Get gmail-settings error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to get Gmail settings' });
  }
});

// PUT /api/auth/me/gmail-settings — saves recovery_email to DB
app.put('/api/auth/me/gmail-settings', authenticate, async (req, res) => {
  try {
    const { recoveryEmail } = req.body || {};
    if (!recoveryEmail || typeof recoveryEmail !== 'string') {
      return res.status(400).json({ success: false, error: 'recoveryEmail is required' });
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    const email = req.user.email;
    await pool.query('UPDATE users SET recovery_email = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2', [recoveryEmail.trim(), email]);
    return res.json({ success: true, message: 'Recovery email saved' });
  } catch (err) {
    console.error('Put gmail-settings error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to save recovery email' });
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

// ─── Gmail OTP endpoints ────────────────────────────────────────────────────

const OTP_KEY = 'counselor_otp';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

// POST /api/auth/forgot/check-email
// Checks if email exists and has recovery email configured
app.post('/api/auth/forgot/check-email', precheckRateLimit('forgot-check-email'), async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ success: false, error: 'Invalid email address' });

  try {
    // Check if user exists and has recovery email configured
    const userResult = await pool.query('SELECT recovery_email FROM users WHERE email = $1', [email.trim()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email not found in our system' });
    }

    const recoveryEmail = userResult.rows[0]?.recovery_email || null;
    if (!recoveryEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'No recovery email configured for this account. Please contact administrator.' 
      });
    }

    return res.json({ 
      success: true, 
      message: 'Email verified. You can now send OTP to your recovery email.' 
    });
  } catch (err) {
    console.error('check-email error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to verify email' });
  }
});

// POST /api/auth/forgot/send-otp
// Generates a 6-digit OTP and emails it to the configured RECOVERY_EMAIL.
app.post('/api/auth/forgot/send-otp', precheckRateLimit('forgot-otp-send'), async (req, res) => {
  const { email } = req.body || {};
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ success: false, error: 'Invalid email address' });

  // Check OTP resend cooldown first
  const remainingCooldown = getOtpCooldown(req);
  if (remainingCooldown) {
    const remainingSeconds = Math.ceil(remainingCooldown / 1000);
    return res.status(429).json({ 
      success: false, 
      error: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
      retryAfterMs: remainingCooldown
    });
  }

  if (!gmailUser || !gmailPass || gmailUser === 'your_gmail@gmail.com') {
    return res.status(503).json({ success: false, error: 'OTP via Gmail is not configured on this server.' });
  }

  // Find the specific user's recovery email
  try {
    const userResult = await pool.query('SELECT recovery_email FROM users WHERE email = $1', [email.trim()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email not found in our system' });
    }

    const recoveryEmail = userResult.rows[0]?.recovery_email || null;
    if (!recoveryEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'No recovery email configured for this account. Please contact administrator.' 
      });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    otpStore.set(OTP_KEY, { otp, expiresAt: Date.now() + OTP_TTL_MS, verified: false });

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass }
      });

      const logoPath = require('path').join(__dirname, '..', 'GuidanceOS-system-logo.png');
      const logoExists = require('fs').existsSync(logoPath);

      await transporter.sendMail({
        from: `"GuidanceOS Security" <${gmailUser}>`,
        to: recoveryEmail,
        subject: 'GuidanceOS — Password Reset OTP',
        text: `Your one-time password (OTP) for GuidanceOS password reset is:\n\n  ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header banner -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2d5f8a 100%);padding:32px 40px;text-align:center">
            ${logoExists ? `<img src="cid:guidanceos-logo" alt="GuidanceOS" style="height:48px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto" />` : ''}
            <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">GuidanceOS</div>
            <div style="color:#93c5fd;font-size:13px;margin-top:4px">Web-based Guidance Monitoring System</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1e3a5f">Password Reset Request</p>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6">
              We received a request to reset the password for the counselor account. Use the one-time password below to proceed.
            </p>

            <!-- OTP box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td align="center" style="background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:12px;padding:24px">
                  <div style="font-size:11px;font-weight:600;letter-spacing:2px;color:#64748b;text-transform:uppercase;margin-bottom:10px">Your One-Time Password</div>
                  <div style="font-size:42px;font-weight:800;letter-spacing:10px;color:#1e3a5f;font-family:'Courier New',monospace">${otp}</div>
                  <div style="margin-top:12px;display:inline-block;background:#fef3c7;border:1px solid #fde68a;border-radius:20px;padding:4px 14px;font-size:12px;color:#92400e;font-weight:600">
                    ⏱ Expires in 10 minutes
                  </div>
                </td>
              </tr>
            </table>

            <!-- Steps -->
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151">How to use this OTP:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#4b5563">
                  <span style="display:inline-block;width:20px;height:20px;background:#1e3a5f;color:#fff;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;margin-right:8px;vertical-align:middle">1</span>
                  Go to the <strong>Forgot Password</strong> page on GuidanceOS.
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#4b5563">
                  <span style="display:inline-block;width:20px;height:20px;background:#1e3a5f;color:#fff;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;margin-right:8px;vertical-align:middle">2</span>
                  Select the <strong>Gmail OTP</strong> tab.
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#4b5563">
                  <span style="display:inline-block;width:20px;height:20px;background:#1e3a5f;color:#fff;border-radius:50%;text-align:center;line-height:20px;font-size:11px;font-weight:700;margin-right:8px;vertical-align:middle">3</span>
                  Enter the 6-digit code above and set your new password.
                </td>
              </tr>
            </table>

            <!-- Warning box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:12px 16px;font-size:13px;color:#9a3412;line-height:1.5">
                  <strong>Didn't request this?</strong> You can safely ignore this email. Your password will not be changed unless you complete the reset process.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center">
            <p style="margin:0;font-size:12px;color:#94a3b8">This is an automated message from <strong>GuidanceOS</strong>. Please do not reply to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      attachments: logoExists ? [{
        filename: 'GuidanceOS-system-logo.png',
        path: logoPath,
        cid: 'guidanceos-logo'
      }] : []
    });

    // Mask the recovery email before sending it back (e.g. jo***@gmail.com)
    const masked = recoveryEmail.replace(/^(.{2})(.+?)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c);
    
    // Set 60-second cooldown for this IP
    setOtpCooldown(req, 60000);
    
    return res.json({ success: true, message: `OTP sent to ${masked}` });
  } catch (err) {
    console.error('send-otp error:', err.message || err);
    otpStore.delete(OTP_KEY);
    return res.status(500).json({ success: false, error: 'Failed to send OTP. Check Gmail configuration.' });
  }
} catch (err) {
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to verify recovery email. Please contact administrator.' 
    });
  }
});

// POST /api/auth/forgot/verify-otp
// Validates the OTP. On success marks it as verified in the store.
app.post('/api/auth/forgot/verify-otp', precheckRateLimit('forgot-otp-verify'), async (req, res) => {
  const { otp } = req.body || {};
  if (!otp) return res.status(400).json({ success: false, error: 'OTP is required' });

  const stored = otpStore.get(OTP_KEY);
  if (!stored || Date.now() > stored.expiresAt) {
    otpStore.delete(OTP_KEY);
    const attemptInfo = recordFailedAttempt(req, 'forgot-otp-verify');
    return res.status(400).json({ 
      success: false, 
      error: 'OTP has expired. Please request a new one.',
      remainingAttempts: attemptInfo.remainingAttempts
    });
  }

  if (stored.otp !== String(otp).trim()) {
    const attemptInfo = recordFailedAttempt(req, 'forgot-otp-verify');
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid OTP.',
      remainingAttempts: attemptInfo.remainingAttempts
    });
  }

  // Mark as verified and extend expiry by 5 more minutes for form completion
  otpStore.set(OTP_KEY, { ...stored, verified: true, expiresAt: Date.now() + 5 * 60 * 1000 });
  try { clearAttempts(req, 'forgot-otp-verify'); } catch (e) { /* no-op */ }
  return res.json({ success: true });
});

// POST /api/auth/forgot/reset-with-otp
// Resets the counselor password using a previously verified OTP session.
app.post('/api/auth/forgot/reset-with-otp', precheckRateLimit('forgot-otp-reset'), async (req, res) => {
  const { newPassword, email } = req.body || {};
  if (!newPassword) return res.status(400).json({ success: false, error: 'newPassword is required' });
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

  const stored = otpStore.get(OTP_KEY);
  if (!stored || !stored.verified || Date.now() > stored.expiresAt) {
    otpStore.delete(OTP_KEY);
    return res.status(400).json({ success: false, error: 'OTP session expired. Please start over.' });
  }

  const requireLetterAndDigit = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
  if (!requireLetterAndDigit.test(newPassword)) {
    return res.status(400).json({ success: false, error: 'New password must include at least one letter and one number, one uppercase letter, and one special character' });
  }

  try {
    // Update the specific user's password (not just counselor role)
    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2', [newPassword, email.trim()]);
    otpStore.delete(OTP_KEY);
    try { 
      clearAttempts(req, 'forgot-otp-reset'); 
      // Also clear login attempts since password was successfully reset
      clearAttempts(req, 'login'); 
    } catch (e) { /* no-op */ }
    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('reset-with-otp error:', err.message || err);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// Run DB migrations on startup, then start server
(async () => {
  try {
    await ensureAdminRole();
    await ensureSignupRequestsTable();
    await ensureStudentReportsTable();
    await ensureAdmissionSlipsColumns();
    await seedStudentManualViolationTypes();
    await ensureRecoveryEmailColumn();
  } catch (err) {
    console.warn('Startup migration warning:', err.message || err);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database: ${DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
    console.log(`CORS enabled for: ${CORS_ORIGIN}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
})();

// Forgot password - return the counselor's saved security question (no email required)
// Removed

// Forgot password - verify provided answer against saved counselor answer and reset password
// Removed

// Forgot password - verify provided answer only (does not change password)
// Removed
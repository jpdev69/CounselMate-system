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
// Mount router for admission slips (consolidated routes in router module)
const admissionSlipsRouter = require('./routes/admissionSlips');
app.use('/api/admission-slips', admissionSlipsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
  console.log(`🌐 CORS enabled for: ${CORS_ORIGIN}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
});
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/admin/settings/student-edit-override - Get current override status
router.get('/student-edit-override', async (req, res) => {
  try {
    // For simplicity, we'll store this in environment variable or a settings table
    // For now, let's use a simple approach with a settings table
    const result = await db.query(`
      SELECT value FROM admin_settings 
      WHERE key = 'student_edit_override'
    `);

    const isEnabled = result.rows.length > 0 && result.rows[0].value === 'true';
    
    res.json({
      success: true,
      enabled: isEnabled
    });

  } catch (error) {
    console.error('Get student edit override error:', error);
    // If settings table doesn't exist, return false by default
    res.json({
      success: true,
      enabled: false
    });
  }
});

// PUT /api/admin/settings/student-edit-override - Update override status
router.put('/student-edit-override', async (req, res) => {
  try {
    const { enabled } = req.body;

    // Ensure admin_settings table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Update or insert the setting
    await db.query(`
      INSERT INTO admin_settings (key, value, updated_at)
      VALUES ('student_edit_override', $1, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW()
    `, [enabled ? 'true' : 'false']);

    res.json({
      success: true,
      message: `Student edit override ${enabled ? 'enabled' : 'disabled'}`,
      enabled
    });

  } catch (error) {
    console.error('Update student edit override error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/settings/student-edit-override - Public endpoint for counselors to check
router.get('/student-edit-override', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT value FROM admin_settings 
      WHERE key = 'student_edit_override'
    `);

    const isEnabled = result.rows.length > 0 && result.rows[0].value === 'true';
    
    res.json({
      enabled: isEnabled
    });

  } catch (error) {
    console.error('Get student edit override error:', error);
    res.json({
      enabled: false
    });
  }
});

module.exports = router;

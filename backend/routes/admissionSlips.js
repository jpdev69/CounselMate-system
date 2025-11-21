const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Your database connection

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

    res.json({ 
      success: true, 
      slip: result.rows[0] 
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

    res.json({ 
      success: true, 
      slip: result.rows[0] 
    });
  } catch (error) {
    console.error('Approve slip error:', error);
    res.status(500).json({ 
      error: 'Failed to approve slip' 
    });
  }
});

module.exports = router;
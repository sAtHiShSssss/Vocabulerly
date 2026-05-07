const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/stats/history - Get learning history
router.get('/history', (req, res) => {
  try {
    const { days = 30 } = req.query;
    const stats = db.prepare(`
      SELECT * FROM user_stats 
      WHERE date >= date('now', '-' || @days || ' days')
      ORDER BY date DESC
    `).all({ days: parseInt(days) });

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats history' });
  }
});

// GET /api/stats/categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT w.category, 
        COUNT(*) as total,
        SUM(CASE WHEN p.status = 'learned' THEN 1 ELSE 0 END) as learned,
        SUM(CASE WHEN p.status = 'difficult' THEN 1 ELSE 0 END) as difficult,
        SUM(CASE WHEN p.status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN p.status IS NULL OR p.status = 'not_learned' THEN 1 ELSE 0 END) as not_learned
      FROM words w 
      LEFT JOIN user_progress p ON w.id = p.word_id
      GROUP BY w.category
    `).all();

    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch category stats' });
  }
});

module.exports = router;

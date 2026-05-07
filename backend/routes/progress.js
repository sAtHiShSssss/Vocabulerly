const express = require('express');
const router = express.Router();
const db = require('../database');

// Spaced repetition intervals (in hours)
const INTERVALS = {
  1: 4,      // 4 hours
  2: 24,     // 1 day
  3: 72,     // 3 days
  4: 168,    // 1 week
  5: 336,    // 2 weeks
  6: 720,    // 1 month
  7: 2160,   // 3 months
};

function getNextReviewDate(timesReviewed, status) {
  if (status === 'difficult') {
    // Difficult words: review sooner
    const hours = Math.min(timesReviewed * 2, 24);
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }
  const level = Math.min(timesReviewed, 7);
  const hours = INTERVALS[level] || 4;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// POST /api/progress/update - Update word progress
router.post('/update', (req, res) => {
  try {
    const { word_id, status } = req.body;

    if (!word_id || !status) {
      return res.status(400).json({ error: 'word_id and status are required' });
    }

    // Check if progress exists
    const existing = db.prepare('SELECT * FROM user_progress WHERE word_id = ?').get(word_id);

    if (existing) {
      const timesReviewed = existing.times_reviewed + 1;
      const nextReview = getNextReviewDate(timesReviewed, status);

      db.prepare(`
        UPDATE user_progress 
        SET status = @status, 
            times_reviewed = @times_reviewed,
            last_reviewed_at = datetime('now'),
            next_review_at = @next_review,
            updated_at = datetime('now')
        WHERE word_id = @word_id
      `).run({
        status,
        times_reviewed: timesReviewed,
        next_review: nextReview,
        word_id
      });
    } else {
      const nextReview = getNextReviewDate(1, status);
      db.prepare(`
        INSERT INTO user_progress (word_id, status, times_reviewed, last_reviewed_at, next_review_at)
        VALUES (@word_id, @status, 1, datetime('now'), @next_review)
      `).run({ word_id, status, next_review: nextReview });
    }

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = db.prepare('SELECT * FROM user_stats WHERE date = ?').get(today);
    
    if (todayStats) {
      if (status === 'learned') {
        db.prepare('UPDATE user_stats SET words_learned = words_learned + 1, words_reviewed = words_reviewed + 1 WHERE date = ?').run(today);
      } else {
        db.prepare('UPDATE user_stats SET words_reviewed = words_reviewed + 1 WHERE date = ?').run(today);
      }
    } else {
      db.prepare('INSERT INTO user_stats (date, words_learned, words_reviewed) VALUES (?, ?, 1)').run(
        today, status === 'learned' ? 1 : 0
      );
    }

    // Update streak
    updateStreak(today);

    res.json({ success: true, message: `Word marked as ${status}` });
  } catch (err) {
    console.error('Error updating progress:', err);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// POST /api/progress/quiz - Record quiz result
router.post('/quiz', (req, res) => {
  try {
    const { word_id, correct } = req.body;

    if (word_id === undefined || correct === undefined) {
      return res.status(400).json({ error: 'word_id and correct are required' });
    }

    const existing = db.prepare('SELECT * FROM user_progress WHERE word_id = ?').get(word_id);

    if (existing) {
      const timesCorrect = correct ? existing.times_correct + 1 : existing.times_correct;
      // Don't demote learned words on wrong quiz answers — only promote or keep status
      let newStatus;
      if (correct) {
        newStatus = 'learned';
      } else if (existing.status === 'learned') {
        newStatus = 'learned'; // preserve learned status
      } else {
        newStatus = 'difficult';
      }
      const timesReviewed = existing.times_reviewed + 1;
      const nextReview = getNextReviewDate(timesReviewed, newStatus);

      db.prepare(`
        UPDATE user_progress 
        SET times_reviewed = @times_reviewed,
            times_correct = @times_correct,
            status = @status,
            last_reviewed_at = datetime('now'),
            next_review_at = @next_review,
            updated_at = datetime('now')
        WHERE word_id = @word_id
      `).run({
        times_reviewed: timesReviewed,
        times_correct: timesCorrect,
        status: newStatus,
        next_review: nextReview,
        word_id
      });
    } else {
      const nextReview = getNextReviewDate(1, correct ? 'learned' : 'difficult');
      db.prepare(`
        INSERT INTO user_progress (word_id, status, times_reviewed, times_correct, last_reviewed_at, next_review_at)
        VALUES (@word_id, @status, 1, @times_correct, datetime('now'), @next_review)
      `).run({
        word_id,
        status: correct ? 'learned' : 'difficult',
        times_correct: correct ? 1 : 0,
        next_review: nextReview
      });
    }

    // Update daily quiz stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = db.prepare('SELECT * FROM user_stats WHERE date = ?').get(today);
    
    if (todayStats) {
      db.prepare(`
        UPDATE user_stats 
        SET quiz_score = quiz_score + @score, quiz_total = quiz_total + 1, words_reviewed = words_reviewed + 1
        WHERE date = ?
      `).run({ score: correct ? 1 : 0 }, today);
    } else {
      db.prepare('INSERT INTO user_stats (date, words_reviewed, quiz_score, quiz_total) VALUES (?, 1, ?, 1)').run(
        today, correct ? 1 : 0
      );
    }

    updateStreak(today);

    res.json({ success: true });
  } catch (err) {
    console.error('Error recording quiz result:', err);
    res.status(500).json({ error: 'Failed to record quiz result' });
  }
});

// GET /api/progress/summary
router.get('/summary', (req, res) => {
  try {
    const totalWords = db.prepare('SELECT COUNT(*) as count FROM words').get().count;
    const learned = db.prepare("SELECT COUNT(*) as count FROM user_progress WHERE status = 'learned'").get().count;
    const difficult = db.prepare("SELECT COUNT(*) as count FROM user_progress WHERE status = 'difficult'").get().count;
    const skipped = db.prepare("SELECT COUNT(*) as count FROM user_progress WHERE status = 'skipped'").get().count;
    const reviewed = db.prepare("SELECT COUNT(*) as count FROM user_progress").get().count;

    const streak = db.prepare('SELECT * FROM streaks LIMIT 1').get();

    const today = new Date().toISOString().split('T')[0];
    const todayStats = db.prepare('SELECT * FROM user_stats WHERE date = ?').get(today) || {
      words_learned: 0, words_reviewed: 0, quiz_score: 0, quiz_total: 0
    };

    // Category breakdown
    const categoryProgress = db.prepare(`
      SELECT w.category, 
        COUNT(*) as total,
        SUM(CASE WHEN p.status = 'learned' THEN 1 ELSE 0 END) as learned
      FROM words w 
      LEFT JOIN user_progress p ON w.id = p.word_id
      GROUP BY w.category
    `).all();

    // Difficulty breakdown
    const difficultyProgress = db.prepare(`
      SELECT w.difficulty_level,
        COUNT(*) as total,
        SUM(CASE WHEN p.status = 'learned' THEN 1 ELSE 0 END) as learned,
        SUM(CASE WHEN p.status = 'difficult' THEN 1 ELSE 0 END) as difficult,
        SUM(CASE WHEN p.status = 'skipped' THEN 1 ELSE 0 END) as skipped
      FROM words w
      LEFT JOIN user_progress p ON w.id = p.word_id
      GROUP BY w.difficulty_level
      ORDER BY w.difficulty_level
    `).all().map(r => ({
      level: r.difficulty_level,
      label: ['', 'easy', 'medium', 'hard'][r.difficulty_level] || 'unknown',
      total: r.total,
      learned: r.learned || 0,
      difficult: r.difficult || 0,
      skipped: r.skipped || 0
    }));

    res.json({
      totalWords,
      learned,
      difficult,
      skipped,
      reviewed,
      remaining: totalWords - learned,
      accuracy: reviewed > 0 ? Math.round((learned / reviewed) * 100) : 0,
      streak: streak || { current_streak: 0, longest_streak: 0, daily_goal: 10 },
      todayStats,
      categoryProgress,
      difficultyProgress
    });
  } catch (err) {
    console.error('Error getting summary:', err);
    res.status(500).json({ error: 'Failed to get progress summary' });
  }
});

// PUT /api/progress/daily-goal
router.put('/daily-goal', (req, res) => {
  try {
    const { goal } = req.body;
    db.prepare('UPDATE streaks SET daily_goal = ?').run(goal);
    res.json({ success: true, daily_goal: goal });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update daily goal' });
  }
});

// POST /api/progress/reset
router.post('/reset', (req, res) => {
  try {
    db.prepare('DELETE FROM user_progress').run();
    db.prepare('DELETE FROM user_stats').run();
    db.prepare('UPDATE streaks SET current_streak = 0, longest_streak = 0, last_activity_date = NULL').run();
    res.json({ success: true, message: 'Progress reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset progress' });
  }
});

function updateStreak(today) {
  const streak = db.prepare('SELECT * FROM streaks LIMIT 1').get();
  if (!streak) return;

  const lastDate = streak.last_activity_date;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (lastDate === today) {
    // Already counted today
    return;
  } else if (lastDate === yesterday) {
    // Consecutive day
    const newStreak = streak.current_streak + 1;
    const longest = Math.max(newStreak, streak.longest_streak);
    db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_activity_date = ?')
      .run(newStreak, longest, today);
  } else {
    // Streak broken or first day
    db.prepare('UPDATE streaks SET current_streak = 1, last_activity_date = ?').run(today);
  }
}

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/quiz/mcq - Generate MCQ quiz questions
router.get('/mcq', (req, res) => {
  try {
    const { category, count = 10 } = req.query;
    let catFilter = '';
    let params = {};

    if (category && category !== 'all') {
      catFilter = 'WHERE w.category = @category';
      params.category = category;
    }

    // Difficulty filter
    if (req.query.difficulty && req.query.difficulty !== 'all') {
      const diffs = req.query.difficulty.split(',').map(d => ({'easy':1,'medium':2,'hard':3}[d] || parseInt(d))).filter(Boolean);
      if (diffs.length) {
        const diffClause = `w.difficulty_level IN (${diffs.join(',')})`;
        catFilter = catFilter ? catFilter + ' AND ' + diffClause : 'WHERE ' + diffClause;
      }
    }

    // Only quiz on learned words
    const learnedClause = "p.status = 'learned'";
    if (catFilter) {
      catFilter += ' AND ' + learnedClause;
    } else {
      catFilter = 'WHERE ' + learnedClause;
    }

    params.count = parseInt(count);
    const questions = db.prepare(`
      SELECT w.* FROM words w
      JOIN user_progress p ON w.id = p.word_id
      ${catFilter}
      ORDER BY RANDOM() LIMIT @count
    `).all(params);

    if (questions.length === 0) {
      return res.json({ questions: [], total: 0, message: 'No learned words yet. Learn some words first!' });
    }

    // Get all learned words for wrong answer pool
    const learnedWords = db.prepare(
      "SELECT w.id, w.meaning FROM words w JOIN user_progress p ON w.id = p.word_id WHERE p.status = 'learned'"
    ).all();

    // Fall back to all words if not enough learned words for distractors
    const answerPool = learnedWords.length >= 4
      ? learnedWords
      : db.prepare('SELECT id, meaning FROM words').all();

    const quiz = questions.map(q => {
      const wrongAnswers = answerPool
        .filter(w => w.id !== q.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => ({ id: w.id, meaning: w.meaning }));

      const options = [
        { id: q.id, meaning: q.meaning, correct: true },
        ...wrongAnswers.map(w => ({ ...w, correct: false }))
      ].sort(() => Math.random() - 0.5);

      return {
        id: q.id,
        word: q.word,
        part_of_speech: q.part_of_speech,
        category: q.category,
        options
      };
    });

    res.json({ questions: quiz, total: quiz.length });
  } catch (err) {
    console.error('Error generating MCQ quiz:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// GET /api/quiz/fill-blank - Generate fill-in-the-blank questions
router.get('/fill-blank', (req, res) => {
  try {
    const { category, count = 10 } = req.query;
    let catFilter = '';
    let params = {};

    if (category && category !== 'all') {
      catFilter = 'WHERE w.category = @category';
      params.category = category;
    }

    // Difficulty filter for fill-blank
    if (req.query.difficulty && req.query.difficulty !== 'all') {
      const diffs = req.query.difficulty.split(',').map(d => ({'easy':1,'medium':2,'hard':3}[d] || parseInt(d))).filter(Boolean);
      if (diffs.length) {
        const diffClause = `w.difficulty_level IN (${diffs.join(',')})`;
        catFilter = catFilter ? catFilter + ' AND ' + diffClause : 'WHERE ' + diffClause;
      }
    }

    // Only quiz on learned words
    const learnedClause2 = "p.status = 'learned'";
    if (catFilter) {
      catFilter += ' AND ' + learnedClause2;
    } else {
      catFilter = 'WHERE ' + learnedClause2;
    }

    params.count = parseInt(count);
    const questions = db.prepare(`
      SELECT w.* FROM words w
      JOIN user_progress p ON w.id = p.word_id
      ${catFilter}
      ORDER BY RANDOM() LIMIT @count
    `).all(params);

    if (questions.length === 0) {
      return res.json({ questions: [], total: 0, message: 'No learned words yet. Learn some words first!' });
    }

    const quiz = questions.map(q => {
      // Replace the word in the example with a blank
      const regex = new RegExp(`\\b${q.word}\\b`, 'gi');
      const sentence = q.example.replace(regex, '_____');

      return {
        id: q.id,
        word: q.word,
        meaning: q.meaning,
        part_of_speech: q.part_of_speech,
        category: q.category,
        sentence,
        original_sentence: q.example
      };
    });

    res.json({ questions: quiz, total: quiz.length });
  } catch (err) {
    console.error('Error generating fill-blank quiz:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// GET /api/quiz/review - Quiz from learned/difficult words
router.get('/review', (req, res) => {
  try {
    const { status = 'learned', count = 10 } = req.query;
    
    const questions = db.prepare(`
      SELECT w.* FROM words w 
      JOIN user_progress p ON w.id = p.word_id 
      WHERE p.status = @status
      ORDER BY RANDOM() 
      LIMIT @count
    `).all({ status, count: parseInt(count) });

    const allWords = db.prepare('SELECT id, word, meaning FROM words').all();

    const quiz = questions.map(q => {
      const wrongAnswers = allWords
        .filter(w => w.id !== q.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => ({ id: w.id, meaning: w.meaning }));

      const options = [
        { id: q.id, meaning: q.meaning, correct: true },
        ...wrongAnswers.map(w => ({ ...w, correct: false }))
      ].sort(() => Math.random() - 0.5);

      return {
        id: q.id,
        word: q.word,
        part_of_speech: q.part_of_speech,
        category: q.category,
        options
      };
    });

    res.json({ questions: quiz, total: quiz.length });
  } catch (err) {
    console.error('Error generating review quiz:', err);
    res.status(500).json({ error: 'Failed to generate review quiz' });
  }
});

// ===== Helper: build WHERE clause for learned words with category + difficulty filters =====
function buildLearnedFilter(req) {
  let catFilter = '';
  const params = {};

  if (req.query.category && req.query.category !== 'all') {
    catFilter = 'WHERE w.category = @category';
    params.category = req.query.category;
  }

  if (req.query.difficulty && req.query.difficulty !== 'all') {
    const diffs = req.query.difficulty.split(',')
      .map(d => ({ easy: 1, medium: 2, hard: 3 }[d] || parseInt(d)))
      .filter(Boolean);
    if (diffs.length) {
      const diffClause = `w.difficulty_level IN (${diffs.join(',')})`;
      catFilter = catFilter ? catFilter + ' AND ' + diffClause : 'WHERE ' + diffClause;
    }
  }

  const learnedClause = "p.status = 'learned'";
  catFilter = catFilter ? catFilter + ' AND ' + learnedClause : 'WHERE ' + learnedClause;

  return { catFilter, params };
}

// GET /api/quiz/reverse-mcq — Show meaning, pick the correct word
router.get('/reverse-mcq', (req, res) => {
  try {
    const { count = 10 } = req.query;
    const { catFilter, params } = buildLearnedFilter(req);
    params.count = parseInt(count);

    const questions = db.prepare(`
      SELECT w.* FROM words w
      JOIN user_progress p ON w.id = p.word_id
      ${catFilter}
      ORDER BY RANDOM() LIMIT @count
    `).all(params);

    if (questions.length === 0) {
      return res.json({ questions: [], total: 0, message: 'No learned words yet. Learn some words first!' });
    }

    const learnedWords = db.prepare(
      "SELECT w.id, w.word FROM words w JOIN user_progress p ON w.id = p.word_id WHERE p.status = 'learned'"
    ).all();
    const answerPool = learnedWords.length >= 4
      ? learnedWords
      : db.prepare('SELECT id, word FROM words').all();

    const quiz = questions.map(q => {
      const wrongAnswers = answerPool
        .filter(w => w.id !== q.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => ({ id: w.id, word: w.word }));

      const options = [
        { id: q.id, word: q.word, correct: true },
        ...wrongAnswers.map(w => ({ ...w, correct: false }))
      ].sort(() => Math.random() - 0.5);

      return {
        id: q.id,
        meaning: q.meaning,
        part_of_speech: q.part_of_speech,
        category: q.category,
        correctWord: q.word,
        options
      };
    });

    res.json({ questions: quiz, total: quiz.length });
  } catch (err) {
    console.error('Error generating reverse-MCQ quiz:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// GET /api/quiz/true-false — Show word + meaning (sometimes wrong) → user judges true/false
router.get('/true-false', (req, res) => {
  try {
    const { count = 10 } = req.query;
    const { catFilter, params } = buildLearnedFilter(req);
    params.count = parseInt(count);

    const questions = db.prepare(`
      SELECT w.* FROM words w
      JOIN user_progress p ON w.id = p.word_id
      ${catFilter}
      ORDER BY RANDOM() LIMIT @count
    `).all(params);

    if (questions.length === 0) {
      return res.json({ questions: [], total: 0, message: 'No learned words yet. Learn some words first!' });
    }

    // Pool of wrong meanings
    const allMeanings = db.prepare('SELECT id, meaning FROM words').all();

    const quiz = questions.map(q => {
      const showCorrect = Math.random() > 0.45; // ~55 % true, ~45 % false
      let displayedMeaning = q.meaning;

      if (!showCorrect) {
        const pool = allMeanings.filter(w => w.id !== q.id);
        displayedMeaning = pool[Math.floor(Math.random() * pool.length)].meaning;
      }

      return {
        id: q.id,
        word: q.word,
        displayedMeaning,
        correctMeaning: q.meaning,
        part_of_speech: q.part_of_speech,
        isTrue: showCorrect
      };
    });

    res.json({ questions: quiz, total: quiz.length });
  } catch (err) {
    console.error('Error generating true/false quiz:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// GET /api/quiz/match — Return N word-meaning pairs for a matching exercise
router.get('/match', (req, res) => {
  try {
    const { count = 6 } = req.query;
    const { catFilter, params } = buildLearnedFilter(req);
    params.count = parseInt(count);

    const pairs = db.prepare(`
      SELECT w.id, w.word, w.meaning, w.part_of_speech FROM words w
      JOIN user_progress p ON w.id = p.word_id
      ${catFilter}
      ORDER BY RANDOM() LIMIT @count
    `).all(params);

    if (pairs.length < 3) {
      return res.json({ pairs: [], total: 0, message: 'Need at least 3 learned words for matching. Keep learning!' });
    }

    res.json({ pairs, total: pairs.length });
  } catch (err) {
    console.error('Error generating match quiz:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// GET /api/quiz/spelling — Hear the word (via TTS on frontend), type its spelling
router.get('/spelling', (req, res) => {
  try {
    const { count = 10 } = req.query;
    const { catFilter, params } = buildLearnedFilter(req);
    params.count = parseInt(count);

    const questions = db.prepare(`
      SELECT w.* FROM words w
      JOIN user_progress p ON w.id = p.word_id
      ${catFilter}
      ORDER BY RANDOM() LIMIT @count
    `).all(params);

    if (questions.length === 0) {
      return res.json({ questions: [], total: 0, message: 'No learned words yet. Learn some words first!' });
    }

    const quiz = questions.map(q => ({
      id: q.id,
      word: q.word,
      meaning: q.meaning,
      part_of_speech: q.part_of_speech,
      category: q.category,
      letterCount: q.word.length,
      firstLetter: q.word[0]
    }));

    res.json({ questions: quiz, total: quiz.length });
  } catch (err) {
    console.error('Error generating spelling quiz:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

module.exports = router;

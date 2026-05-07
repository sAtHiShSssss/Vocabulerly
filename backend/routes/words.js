const express = require('express');
const router = express.Router();
const db = require('../database');

// ─── Example sentence templates (varied, natural-sounding) ────────────────────
const TEMPLATES = {
  noun: [
    (w) => `The ${w} was the main topic of discussion at the meeting.`,
    (w) => `Everyone was surprised by the ${w} that emerged during the investigation.`,
    (w) => `She wrote an essay about the importance of ${w} in modern society.`,
    (w) => `His understanding of ${w} deepened after years of study.`,
    (w) => `The professor explained the ${w} with a clear real-world analogy.`,
    (w) => `A deeper appreciation for ${w} can change the way you see the world.`,
    (w) => `They spent hours debating the true nature of ${w}.`,
    (w) => `The article shed new light on the meaning of ${w}.`,
  ],
  verb: [
    (w) => `She learned to ${w} after months of dedicated practice.`,
    (w) => `The manager asked the team to ${w} before the deadline.`,
    (w) => `It takes courage to ${w} when everyone else stays silent.`,
    (w) => `He didn't know how to ${w}, so he asked his mentor for advice.`,
    (w) => `They tried to ${w} the situation before it got out of hand.`,
    (w) => `The ability to ${w} is a skill that improves with experience.`,
    (w) => `You shouldn't ${w} without fully understanding the consequences.`,
    (w) => `We need to ${w} quickly if we want to stay ahead.`,
  ],
  adjective: [
    (w) => `The sunset was incredibly ${w}, leaving everyone speechless.`,
    (w) => `She found the new approach to be surprisingly ${w}.`,
    (w) => `The ${w} landscape stretched out as far as the eye could see.`,
    (w) => `He described the experience as deeply ${w} and transformative.`,
    (w) => `The audience found the performance to be remarkably ${w}.`,
    (w) => `Nothing about the situation felt ${w} to the investigators.`,
    (w) => `The ${w} quality of the writing made it stand out from the rest.`,
    (w) => `It's rare to find something so genuinely ${w} in today's world.`,
  ],
  adverb: [
    (w) => `She spoke ${w}, holding the attention of the entire room.`,
    (w) => `He ${w} completed the project ahead of schedule.`,
    (w) => `The team worked ${w} to meet the client's expectations.`,
    (w) => `The river flowed ${w} through the quiet valley.`,
    (w) => `She ${w} accepted the challenge despite the risks involved.`,
    (w) => `The negotiations proceeded ${w}, much to everyone's relief.`,
    (w) => `He ${w} approached the problem from a different angle.`,
    (w) => `The news spread ${w} across the entire community.`,
  ],
  default: [
    (w) => `Understanding the meaning of "${w}" can enrich your vocabulary.`,
    (w) => `The use of "${w}" in literature often carries deeper significance.`,
    (w) => `She encountered the word "${w}" while reading a classic novel.`,
    (w) => `In academic writing, "${w}" is used to convey a precise meaning.`,
    (w) => `The speaker used "${w}" to make a compelling argument.`,
    (w) => `Learning words like "${w}" helps build stronger communication skills.`,
  ],
};

function pickTemplate(partOfSpeech, word) {
  const list = TEMPLATES[partOfSpeech] || TEMPLATES.default;
  // Use a simple hash of the word to pick a consistent but varied template
  const hash = word.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return list[hash % list.length](word);
}

// ─── Source 1: Free Dictionary API ────────────────────────────────────────────
async function fetchFromFreeDictionary(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
    const meanings = entry.meanings || [];

    let bestMeaning = '', bestExample = '', bestPoS = '';
    let fallbackMeaning = '', fallbackPoS = '';

    for (const m of meanings) {
      for (const def of (m.definitions || [])) {
        if (!fallbackMeaning && def.definition) {
          fallbackMeaning = def.definition;
          fallbackPoS = m.partOfSpeech || '';
        }
        if (!bestExample && def.example) {
          bestMeaning = def.definition || '';
          bestExample = def.example;
          bestPoS = m.partOfSpeech || '';
        }
        if (bestExample) break;
      }
      if (bestExample) break;
    }

    return {
      word: entry.word || word,
      meaning: bestMeaning || fallbackMeaning,
      part_of_speech: bestExample ? bestPoS : fallbackPoS,
      example: bestExample,
    };
  } catch (err) {
    console.error('Free Dictionary API error:', err.message);
    return null;
  }
}

// ─── Source 2: Wiktionary REST API (for examples when source 1 has none) ──────
async function fetchExampleFromWiktionary(word) {
  try {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
    if (!res.ok) return null;
    const data = await res.json();

    // Walk through all languages (prefer English)
    for (const lang of Object.keys(data)) {
      const entries = data[lang] || [];
      for (const entry of entries) {
        const defs = entry.definitions || [];
        for (const def of defs) {
          // Wiktionary returns examples as an array of HTML strings
          const examples = def.examples || [];
          for (const ex of examples) {
            // Strip HTML tags to get plain text
            const plain = (typeof ex === 'string' ? ex : ex.text || '')
              .replace(/<[^>]+>/g, '')
              .trim();
            if (plain && plain.length > 10 && plain.length < 300) {
              return plain;
            }
          }
        }
      }
    }
    return null;
  } catch (err) {
    console.error('Wiktionary API error:', err.message);
    return null;
  }
}

// ─── Combined: fetch definition with multi-source example resolution ──────────
async function fetchDefinition(word) {
  // Step 1: Get the definition + try for an example from Free Dictionary API
  const primary = await fetchFromFreeDictionary(word);
  if (!primary || !primary.meaning) return null;

  // Step 2: If no example from primary, try Wiktionary
  if (!primary.example) {
    const wiktionaryExample = await fetchExampleFromWiktionary(word);
    if (wiktionaryExample) {
      primary.example = wiktionaryExample;
    }
  }

  // Step 3: If still no example, use a varied natural template
  if (!primary.example) {
    primary.example = pickTemplate(primary.part_of_speech, word);
  }

  return primary;
}

// GET /api/words/lookup/:word - Look up a word; if not in DB, fetch from dictionary API & add it
router.get('/lookup/:word', async (req, res) => {
  try {
    const lookupWord = req.params.word.trim().toLowerCase();
    if (!lookupWord) {
      return res.status(400).json({ error: 'Word is required' });
    }

    // Check if it exists in our DB
    const existing = db.prepare(`
      SELECT w.*,
        COALESCE(p.status, 'not_learned') as learn_status,
        COALESCE(p.times_reviewed, 0) as times_reviewed
      FROM words w
      LEFT JOIN user_progress p ON w.id = p.word_id
      WHERE LOWER(w.word) = ?
    `).get(lookupWord);

    if (existing) {
      return res.json({ word: existing, source: 'local' });
    }

    // Not in DB — fetch from Free Dictionary API
    const definition = await fetchDefinition(lookupWord);
    if (!definition) {
      return res.status(404).json({ 
        error: 'Word not found',
        message: `Could not find a definition for "${lookupWord}". Check spelling and try again.`
      });
    }

    // Insert into DB as a user-added word (general category, medium difficulty)
    const insertResult = db.prepare(`
      INSERT INTO words (word, meaning, part_of_speech, example, category, difficulty_level)
      VALUES (@word, @meaning, @part_of_speech, @example, 'general', 2)
    `).run({
      word: definition.word,
      meaning: definition.meaning,
      part_of_speech: definition.part_of_speech,
      example: definition.example,
    });

    // Fetch the newly inserted word back with full info
    const newWord = db.prepare(`
      SELECT w.*,
        'not_learned' as learn_status,
        0 as times_reviewed
      FROM words w
      WHERE w.id = ?
    `).get(insertResult.lastInsertRowid);

    res.json({ word: newWord, source: 'dictionary_api', added: true });
  } catch (err) {
    // Handle duplicate word race condition
    if (err.message?.includes('UNIQUE constraint')) {
      const existing = db.prepare(`
        SELECT w.*, COALESCE(p.status, 'not_learned') as learn_status
        FROM words w LEFT JOIN user_progress p ON w.id = p.word_id
        WHERE LOWER(w.word) = ?
      `).get(req.params.word.trim().toLowerCase());
      return res.json({ word: existing, source: 'local' });
    }
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Failed to look up word' });
  }
});
// POST /api/words - Manually add a new word with user-provided meaning & example
router.post('/', (req, res) => {
  try {
    const { word, meaning, example, part_of_speech, category, difficulty_level } = req.body;

    if (!word || !meaning || !example) {
      return res.status(400).json({ error: 'word, meaning, and example are required' });
    }

    const trimmedWord = word.trim().toLowerCase();

    // Check if word already exists
    const existing = db.prepare('SELECT id FROM words WHERE LOWER(word) = ?').get(trimmedWord);
    if (existing) {
      return res.status(409).json({ error: 'Word already exists in your dictionary', word_id: existing.id });
    }

    const validCategories = ['daily', 'workplace', 'general'];
    const cat = validCategories.includes(category) ? category : 'general';
    const diff = [1, 2, 3].includes(Number(difficulty_level)) ? Number(difficulty_level) : 2;

    const result = db.prepare(`
      INSERT INTO words (word, meaning, part_of_speech, example, category, difficulty_level)
      VALUES (@word, @meaning, @pos, @example, @category, @difficulty)
    `).run({
      word: trimmedWord,
      meaning: meaning.trim(),
      pos: (part_of_speech || '').trim() || null,
      example: example.trim(),
      category: cat,
      difficulty: diff,
    });

    const newWord = db.prepare(`
      SELECT w.*, 'not_learned' as learn_status, 0 as times_reviewed
      FROM words w WHERE w.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ word: newWord, added: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Word already exists in your dictionary' });
    }
    console.error('Error adding word:', err);
    res.status(500).json({ error: 'Failed to add word' });
  }
});

router.get('/wotd', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    // Use date string as seed for deterministic pick
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
    const totalWords = db.prepare('SELECT COUNT(*) as count FROM words').get().count;
    const wordId = (seed * 7 + seed * seed) % totalWords + 1;

    const word = db.prepare(`
      SELECT w.*,
        COALESCE(p.status, 'not_learned') as learn_status
      FROM words w
      LEFT JOIN user_progress p ON w.id = p.word_id
      WHERE w.id = ?
    `).get(wordId);

    if (!word) {
      // Fallback to random
      const fallback = db.prepare('SELECT * FROM words ORDER BY RANDOM() LIMIT 1').get();
      return res.json(fallback);
    }

    res.json(word);
  } catch (err) {
    console.error('Error getting WOTD:', err);
    res.status(500).json({ error: 'Failed to get word of the day' });
  }
});

// GET /api/words - List words with filtering, search, pagination
router.get('/', (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 20, sort = 'id' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let where = [];
    let params = {};

    if (category && category !== 'all') {
      where.push('w.category = @category');
      params.category = category;
    }

    if (req.query.difficulty && req.query.difficulty !== 'all') {
      const diffs = req.query.difficulty.split(',').map(d => ({'easy':1,'medium':2,'hard':3}[d] || parseInt(d))).filter(Boolean);
      if (diffs.length === 1) {
        where.push('w.difficulty_level = @difficulty');
        params.difficulty = diffs[0];
      } else if (diffs.length > 1) {
        where.push(`w.difficulty_level IN (${diffs.join(',')})`);
      }
    }

    if (search) {
      // Search across word, meaning, and example with relevance ranking
      where.push(`(
        LOWER(w.word) = @searchExact
        OR LOWER(w.word) LIKE @searchStart
        OR LOWER(w.word) LIKE @searchAny
        OR LOWER(w.meaning) LIKE @searchAny
        OR LOWER(w.example) LIKE @searchAny
      )`);
      const s = search.toLowerCase();
      params.searchExact = s;
      params.searchStart = `${s}%`;
      params.searchAny = `%${s}%`;
    }

    if (status && status !== 'all') {
      if (status === 'not_learned') {
        where.push('(p.status IS NULL OR p.status = \'not_learned\')');
      } else {
        where.push('p.status = @status');
        params.status = status;
      }
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    // Count total
    const countSQL = `
      SELECT COUNT(*) as total 
      FROM words w 
      LEFT JOIN user_progress p ON w.id = p.word_id 
      ${whereClause}
    `;
    const { total } = db.prepare(countSQL).get(params);

    // Fetch words
    let orderBy = 'w.id ASC';
    if (search) {
      // Relevance ranking: exact > starts-with > contains-in-word > contains-in-meaning/example
      orderBy = `
        CASE
          WHEN LOWER(w.word) = @searchExact THEN 1
          WHEN LOWER(w.word) LIKE @searchStart THEN 2
          WHEN LOWER(w.word) LIKE @searchAny THEN 3
          WHEN LOWER(w.meaning) LIKE @searchAny THEN 4
          ELSE 5
        END ASC, w.word ASC`;
    }
    if (sort === 'word') orderBy = 'w.word ASC';
    if (sort === 'random') orderBy = 'RANDOM()';
    if (sort === 'difficulty') orderBy = 'w.difficulty_level DESC';

    const dataSQL = `
      SELECT w.*, 
        COALESCE(p.status, 'not_learned') as learn_status,
        COALESCE(p.times_reviewed, 0) as times_reviewed,
        COALESCE(p.times_correct, 0) as times_correct,
        p.last_reviewed_at,
        p.next_review_at
      FROM words w 
      LEFT JOIN user_progress p ON w.id = p.word_id 
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT @limit OFFSET @offset
    `;
    params.limit = parseInt(limit);
    params.offset = offset;

    const words = db.prepare(dataSQL).all(params);

    res.json({
      words,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error fetching words:', err);
    res.status(500).json({ error: 'Failed to fetch words' });
  }
});

// GET /api/words/next - Get next word for learning (spaced repetition)
router.get('/next', (req, res) => {
  try {
    const { category } = req.query;
    let catFilter = '';
    let params = {};

    if (category && category !== 'all') {
      catFilter = 'AND w.category = @category';
      params.category = category;
    }

    // Difficulty filter
    let diffFilter = '';
    if (req.query.difficulty && req.query.difficulty !== 'all') {
      const diffs = req.query.difficulty.split(',').map(d => ({'easy':1,'medium':2,'hard':3}[d] || parseInt(d))).filter(Boolean);
      if (diffs.length) diffFilter = `AND w.difficulty_level IN (${diffs.join(',')})`;
    }

    // Priority 1: Words never seen yet
    let word = db.prepare(`
      SELECT w.*, 'not_learned' as learn_status 
      FROM words w 
      LEFT JOIN user_progress p ON w.id = p.word_id 
      WHERE p.id IS NULL ${catFilter} ${diffFilter}
      ORDER BY RANDOM() 
      LIMIT 1
    `).get(params);

    // Priority 2: Difficult words due for review
    if (!word) {
      word = db.prepare(`
        SELECT w.*, p.status as learn_status, p.times_reviewed, p.times_correct
        FROM words w 
        JOIN user_progress p ON w.id = p.word_id 
        WHERE p.status = 'difficult' 
          AND (p.next_review_at IS NULL OR p.next_review_at <= datetime('now'))
          ${catFilter} ${diffFilter}
        ORDER BY p.next_review_at ASC 
        LIMIT 1
      `).get(params);
    }

    // Priority 3: Any word due for review
    if (!word) {
      word = db.prepare(`
        SELECT w.*, p.status as learn_status, p.times_reviewed, p.times_correct
        FROM words w 
        JOIN user_progress p ON w.id = p.word_id 
        WHERE p.next_review_at IS NOT NULL 
          AND p.next_review_at <= datetime('now')
          ${catFilter} ${diffFilter}
        ORDER BY p.next_review_at ASC 
        LIMIT 1
      `).get(params);
    }

    if (!word) {
      return res.json({ word: null, message: 'All words reviewed! Great job!' });
    }

    res.json({ word });
  } catch (err) {
    console.error('Error getting next word:', err);
    res.status(500).json({ error: 'Failed to get next word' });
  }
});

// GET /api/words/batch - Get a batch of words for learning
router.get('/batch', (req, res) => {
  try {
    const { category, count = 10 } = req.query;
    let catFilter = '';
    let params = { count: parseInt(count) };

    if (category && category !== 'all') {
      catFilter = 'AND w.category = @category';
      params.category = category;
    }

    // Difficulty filter
    let diffFilter = '';
    if (req.query.difficulty && req.query.difficulty !== 'all') {
      const diffs = req.query.difficulty.split(',').map(d => ({'easy':1,'medium':2,'hard':3}[d] || parseInt(d))).filter(Boolean);
      if (diffs.length) diffFilter = `AND w.difficulty_level IN (${diffs.join(',')})`;
    }

    // Mix: mostly unseen words + some due for review
    const unseen = db.prepare(`
      SELECT w.*, 'not_learned' as learn_status 
      FROM words w 
      LEFT JOIN user_progress p ON w.id = p.word_id 
      WHERE p.id IS NULL ${catFilter} ${diffFilter}
      ORDER BY RANDOM() 
      LIMIT @count
    `).all(params);

    const reviewDue = db.prepare(`
      SELECT w.*, p.status as learn_status, p.times_reviewed 
      FROM words w 
      JOIN user_progress p ON w.id = p.word_id 
      WHERE (p.status = 'difficult' OR p.next_review_at <= datetime('now'))
        ${catFilter} ${diffFilter}
      ORDER BY RANDOM() 
      LIMIT @count
    `).all(params);

    // Merge and deduplicate
    const seen = new Set();
    const batch = [];
    for (const w of [...unseen, ...reviewDue]) {
      if (!seen.has(w.id)) {
        seen.add(w.id);
        batch.push(w);
      }
      if (batch.length >= parseInt(count)) break;
    }

    res.json({ words: batch, count: batch.length });
  } catch (err) {
    console.error('Error getting batch:', err);
    res.status(500).json({ error: 'Failed to get word batch' });
  }
});

// GET /api/words/:id
router.get('/:id', (req, res) => {
  try {
    const word = db.prepare(`
      SELECT w.*, 
        COALESCE(p.status, 'not_learned') as learn_status,
        COALESCE(p.times_reviewed, 0) as times_reviewed,
        COALESCE(p.times_correct, 0) as times_correct,
        p.last_reviewed_at
      FROM words w 
      LEFT JOIN user_progress p ON w.id = p.word_id 
      WHERE w.id = ?
    `).get(req.params.id);

    if (!word) return res.status(404).json({ error: 'Word not found' });
    res.json(word);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch word' });
  }
});

// PUT /api/words/:id - Update a word's properties
router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Word not found' });

    const { word, meaning, example, part_of_speech, category, difficulty_level } = req.body;

    const updatedWord = (word !== undefined ? word.trim() : existing.word);
    const updatedMeaning = (meaning !== undefined ? meaning.trim() : existing.meaning);
    const updatedExample = (example !== undefined ? example.trim() : existing.example);
    const updatedPoS = (part_of_speech !== undefined ? (part_of_speech || '').trim() || null : existing.part_of_speech);
    
    const validCategories = ['daily', 'workplace', 'general'];
    const updatedCategory = (category && validCategories.includes(category)) ? category : existing.category;
    const updatedDifficulty = (difficulty_level && [1,2,3].includes(Number(difficulty_level))) ? Number(difficulty_level) : existing.difficulty_level;

    if (!updatedWord || !updatedMeaning || !updatedExample) {
      return res.status(400).json({ error: 'word, meaning, and example cannot be empty' });
    }

    db.prepare(`
      UPDATE words SET
        word = @word, meaning = @meaning, example = @example,
        part_of_speech = @pos, category = @category, difficulty_level = @difficulty
      WHERE id = @id
    `).run({
      word: updatedWord,
      meaning: updatedMeaning,
      example: updatedExample,
      pos: updatedPoS,
      category: updatedCategory,
      difficulty: updatedDifficulty,
      id: parseInt(req.params.id),
    });

    const result = db.prepare(`
      SELECT w.*, COALESCE(p.status, 'not_learned') as learn_status,
        COALESCE(p.times_reviewed, 0) as times_reviewed
      FROM words w LEFT JOIN user_progress p ON w.id = p.word_id
      WHERE w.id = ?
    `).get(req.params.id);

    res.json({ word: result, updated: true });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'A word with that name already exists' });
    }
    console.error('Error updating word:', err);
    res.status(500).json({ error: 'Failed to update word' });
  }
});

// DELETE /api/words/:id - Delete a word and its progress
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM words WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Word not found' });

    db.prepare('DELETE FROM user_progress WHERE word_id = ?').run(req.params.id);
    db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id);

    res.json({ deleted: true, word: existing.word });
  } catch (err) {
    console.error('Error deleting word:', err);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

module.exports = router;

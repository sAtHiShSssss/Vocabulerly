const express = require('express');
const router = express.Router();
const db = require('../database');

let translate;
// google-translate-api-x is ESM, need dynamic import
const loadTranslate = (async () => {
  const mod = await import('google-translate-api-x');
  translate = mod.default || mod.translate;
})();

// Supported languages
const SUPPORTED_LANGUAGES = {
  ta: 'Tamil',
  hi: 'Hindi',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  bn: 'Bengali',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ur: 'Urdu',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
};

// GET /api/translate/languages — List supported languages
router.get('/languages', (req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES });
});

// GET /api/translate/settings — Get user's language preference
router.get('/settings', (req, res) => {
  const row = db.prepare("SELECT value FROM user_settings WHERE key = 'native_language'").get();
  res.json({ language: row ? row.value : 'ta' }); // Default to Tamil
});

// PUT /api/translate/settings — Update user's language preference
router.put('/settings', (req, res) => {
  const { language } = req.body;
  if (!language || !SUPPORTED_LANGUAGES[language]) {
    return res.status(400).json({ error: 'Unsupported language' });
  }

  db.prepare(
    "INSERT INTO user_settings (key, value) VALUES ('native_language', @lang) ON CONFLICT(key) DO UPDATE SET value = @lang"
  ).run({ lang: language });

  res.json({ language, name: SUPPORTED_LANGUAGES[language] });
});

// GET /api/translate/word/:id?lang=ta — Get translation for a single word
router.get('/word/:id', async (req, res) => {
  try {
    await loadTranslate;
    const { id } = req.params;
    const langRow = db.prepare("SELECT value FROM user_settings WHERE key = 'native_language'").get();
    const lang = req.query.lang || (langRow ? langRow.value : 'ta');

    // Check cache first
    const cached = db.prepare(
      'SELECT translated_meaning FROM translations WHERE word_id = @id AND language = @lang'
    ).get({ id, lang });

    if (cached) {
      return res.json({ word_id: parseInt(id), language: lang, translated_meaning: cached.translated_meaning });
    }

    // Get the word's meaning
    const word = db.prepare('SELECT meaning FROM words WHERE id = @id').get({ id });
    if (!word) {
      return res.status(404).json({ error: 'Word not found' });
    }

    // Translate
    const result = await translate(word.meaning, { from: 'en', to: lang });
    const translatedMeaning = result.text;

    // Cache it
    db.prepare(
      'INSERT OR REPLACE INTO translations (word_id, language, translated_meaning) VALUES (@id, @lang, @meaning)'
    ).run({ id, lang, meaning: translatedMeaning });

    res.json({ word_id: parseInt(id), language: lang, translated_meaning: translatedMeaning });
  } catch (err) {
    console.error('Translation error:', err.message);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// POST /api/translate/batch — Translate multiple words at once
router.post('/batch', async (req, res) => {
  try {
    await loadTranslate;
    const { word_ids } = req.body;
    if (!word_ids || !Array.isArray(word_ids) || word_ids.length === 0) {
      return res.status(400).json({ error: 'word_ids array required' });
    }

    const langRow = db.prepare("SELECT value FROM user_settings WHERE key = 'native_language'").get();
    const lang = req.body.lang || (langRow ? langRow.value : 'ta');

    const results = {};

    // Check cache for all
    const placeholders = word_ids.map(() => '?').join(',');
    const cached = db.prepare(
      `SELECT word_id, translated_meaning FROM translations WHERE word_id IN (${placeholders}) AND language = ?`
    ).all(...word_ids, lang);

    for (const row of cached) {
      results[row.word_id] = row.translated_meaning;
    }

    // Find uncached words
    const uncachedIds = word_ids.filter(id => !results[id]);
    
    if (uncachedIds.length > 0) {
      // Get meanings for uncached words
      const uncachedPlaceholders = uncachedIds.map(() => '?').join(',');
      const words = db.prepare(
        `SELECT id, meaning FROM words WHERE id IN (${uncachedPlaceholders})`
      ).all(...uncachedIds);

      // Translate in parallel (batch of up to 10)
      const translatePromises = words.map(async (w) => {
        try {
          const result = await translate(w.meaning, { from: 'en', to: lang });
          return { id: w.id, translated: result.text };
        } catch (err) {
          return { id: w.id, translated: null };
        }
      });

      const translations = await Promise.all(translatePromises);

      // Cache and collect results
      const insertStmt = db.prepare(
        'INSERT OR REPLACE INTO translations (word_id, language, translated_meaning) VALUES (@id, @lang, @meaning)'
      );

      for (const t of translations) {
        if (t.translated) {
          insertStmt.run({ id: t.id, lang, meaning: t.translated });
          results[t.id] = t.translated;
        }
      }
    }

    res.json({ translations: results, language: lang });
  } catch (err) {
    console.error('Batch translation error:', err.message);
    res.status(500).json({ error: 'Batch translation failed' });
  }
});

module.exports = router;

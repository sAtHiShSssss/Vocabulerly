const db = require('./database');
const words1 = require('./data/words.json');
const words2 = require('./data/words_extra.json');

const allWords = [...words1, ...words2];

// Deduplicate by word (keep first occurrence)
const seen = new Set();
const unique = [];
for (const w of allWords) {
  const key = w.word.toLowerCase();
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(w);
  }
}

console.log(`Total unique words: ${unique.length}`);

const insert = db.prepare(`
  INSERT OR IGNORE INTO words (word, meaning, part_of_speech, example, category, difficulty_level)
  VALUES (@word, @meaning, @part_of_speech, @example, @category, @difficulty_level)
`);

const insertMany = db.transaction((words) => {
  let count = 0;
  for (const w of words) {
    const result = insert.run({
      word: w.word,
      meaning: w.meaning,
      part_of_speech: w.part_of_speech || null,
      example: w.example,
      category: w.category,
      difficulty_level: w.difficulty_level || 1
    });
    if (result.changes > 0) count++;
  }
  return count;
});

const inserted = insertMany(unique);
console.log(`Inserted ${inserted} words into the database.`);

// Show category counts
const cats = db.prepare('SELECT category, COUNT(*) as count FROM words GROUP BY category').all();
console.log('Category distribution:', cats);
console.log('Total in DB:', db.prepare('SELECT COUNT(*) as count FROM words').get().count);

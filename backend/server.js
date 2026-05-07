const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files in production
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Routes
const wordsRouter = require('./routes/words');
const progressRouter = require('./routes/progress');
const quizRouter = require('./routes/quiz');
const statsRouter = require('./routes/stats');
const translateRouter = require('./routes/translate');

app.use('/api/words', wordsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/stats', statsRouter);
app.use('/api/translate', translateRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Vocabulerly API server running on http://localhost:${PORT}`);
});

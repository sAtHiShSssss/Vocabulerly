import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { wordsAPI, progressAPI } from '../services/api';
import Flashcard from './Flashcard';
import { ChevronLeft, ChevronRight, Shuffle, Filter, Zap } from 'lucide-react';

const DIFFICULTY_OPTIONS = [
  { key: 'all', label: 'All Levels' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
  { key: 'medium,hard', label: 'Medium + Hard' },
];

export default function LearnMode() {
  const { activeCategory, setActiveCategory, activeDifficulty, setActiveDifficulty, showNotification, refreshSummary, summary } = useApp();
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [batchSize] = useState(10);

  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const cat = activeCategory === 'all' ? undefined : activeCategory;
      const diff = activeDifficulty === 'all' ? undefined : activeDifficulty;
      const data = await wordsAPI.getBatch(batchSize, cat, diff);
      setWords(data.words);
      setCurrentIndex(0);
    } catch (err) {
      showNotification('Failed to load words', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeCategory, activeDifficulty, batchSize, showNotification]);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  const handleAction = async (status) => {
    const word = words[currentIndex];
    if (!word) return;

    try {
      await progressAPI.update(word.id, status);
      showNotification(
        status === 'learned'
          ? `"${word.word}" marked as learned!`
          : status === 'difficult'
          ? `"${word.word}" marked as difficult — it will appear more often`
          : `"${word.word}" skipped`,
        status === 'learned' ? 'success' : 'info'
      );
      refreshSummary();

      if (currentIndex < words.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        loadWords();
      }
    } catch (err) {
      showNotification('Failed to update progress', 'error');
    }
  };

  const goNext = () => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      loadWords();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const todayLearned = summary?.todayStats?.words_learned || 0;
  const dailyGoal = summary?.streak?.daily_goal || 10;
  const goalProgress = Math.min((todayLearned / dailyGoal) * 100, 100);

  return (
    <div className="learn-mode">
      <div className="learn-header">
        <h1>Learn Words</h1>
        <div className="daily-goal-bar">
          <span>Today: {todayLearned}/{dailyGoal} words</span>
          <div className="progress-bar-mini">
            <div className="progress-fill" style={{ width: `${goalProgress}%` }} />
          </div>
        </div>
      </div>

      <div className="category-filter">
        {['all', 'daily', 'workplace', 'general'].map((cat) => (
          <button
            key={cat}
            className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
        <button className="filter-btn icon-only" onClick={loadWords} title="Shuffle">
          <Shuffle size={16} />
        </button>
      </div>

      <div className="difficulty-filter">
        <Zap size={16} />
        {DIFFICULTY_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`filter-btn small ${activeDifficulty === opt.key ? 'active' : ''} diff-${opt.key.split(',')[0]}`}
            onClick={() => setActiveDifficulty(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading words...</p>
        </div>
      ) : words.length === 0 ? (
        <div className="empty-state">
          <p>🎉 All done! No more words to learn in this category.</p>
          <button className="primary-btn" onClick={loadWords}>
            Refresh
          </button>
        </div>
      ) : (
        <>
          <div className="card-counter">
            {currentIndex + 1} / {words.length}
          </div>

          <Flashcard
            word={words[currentIndex]}
            onAction={handleAction}
          />

          <div className="navigation-btns">
            <button
              className="nav-btn"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft size={20} />
              Previous
            </button>
            <button className="nav-btn" onClick={goNext}>
              Next
              <ChevronRight size={20} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

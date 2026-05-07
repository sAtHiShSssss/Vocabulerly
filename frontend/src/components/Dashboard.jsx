import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { wordsAPI } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { Link } from 'react-router-dom';
import {
  BookOpen, Brain, Search, Target, Flame, Trophy,
  TrendingUp, CheckCircle, AlertTriangle, SkipForward, Zap,
  Volume2, Star
} from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { summary, loading, refreshSummary } = useApp();
  const [wotd, setWotd] = useState(null);
  const speak = useSpeech();

  useEffect(() => {
    refreshSummary();
    wordsAPI.getWordOfTheDay().then(setWotd).catch(() => {});
  }, [refreshSummary]);

  if (loading || !summary) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const {
    totalWords, learned, difficult, skipped, remaining,
    accuracy, streak, todayStats, categoryProgress, difficultyProgress
  } = summary;

  const todayLearned = todayStats?.words_learned || 0;
  const dailyGoal = streak?.daily_goal || 10;
  const goalProgress = Math.min((todayLearned / dailyGoal) * 100, 100);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>{getGreeting()} 👋</h1>
          <p className="subtitle">Build your English vocabulary, one word at a time</p>
        </div>
        <div className="streak-badge">
          <Flame size={24} className={streak?.current_streak > 0 ? 'flame-active' : ''} />
          <div>
            <span className="streak-count">{streak?.current_streak || 0}</span>
            <span className="streak-label">day streak</span>
          </div>
        </div>
      </div>

      {/* Word of the Day */}
      {wotd && (
        <div className="wotd-card">
          <div className="wotd-header">
            <Star size={18} />
            <span>Word of the Day</span>
          </div>
          <div className="wotd-body">
            <div className="wotd-word">
              <h2>{wotd.word}</h2>
              <button className="icon-btn" onClick={() => speak(wotd.word)} title="Pronounce">
                <Volume2 size={18} />
              </button>
              {wotd.part_of_speech && <span className="pos-badge">{wotd.part_of_speech}</span>}
            </div>
            <p className="wotd-meaning">{wotd.meaning}</p>
            <p className="wotd-example">"{wotd.example}"</p>
          </div>
        </div>
      )}

      {/* Daily Goal */}
      <div className="daily-goal-card">
        <div className="daily-goal-header">
          <Target size={20} />
          <span>Daily Goal: {todayLearned}/{dailyGoal} words</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${goalProgress}%` }}
          />
        </div>
        {goalProgress >= 100 && (
          <p className="goal-complete">🎉 Daily goal achieved!</p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <CheckCircle size={24} className="stat-icon learned" />
          <div className="stat-info">
            <span className="stat-value">{learned}</span>
            <span className="stat-label">Learned</span>
          </div>
        </div>
        <div className="stat-card">
          <AlertTriangle size={24} className="stat-icon difficult" />
          <div className="stat-info">
            <span className="stat-value">{difficult}</span>
            <span className="stat-label">Difficult</span>
          </div>
        </div>
        <div className="stat-card">
          <SkipForward size={24} className="stat-icon skipped" />
          <div className="stat-info">
            <span className="stat-value">{skipped}</span>
            <span className="stat-label">Skipped</span>
          </div>
        </div>
        <div className="stat-card">
          <TrendingUp size={24} className="stat-icon accuracy" />
          <div className="stat-info">
            <span className="stat-value">{accuracy}%</span>
            <span className="stat-label">Accuracy</span>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="overall-progress">
        <h3>Overall Progress</h3>
        <div className="progress-bar large">
          <div
            className="progress-fill"
            style={{ width: `${totalWords > 0 ? (learned / totalWords) * 100 : 0}%` }}
          />
        </div>
        <div className="progress-text">
          <span>{learned} of {totalWords} words learned</span>
          <span>{remaining} remaining</span>
        </div>
      </div>

      {/* Difficulty Progress */}
      <div className="difficulty-progress">
        <h3><Zap size={18} /> Progress by Difficulty</h3>
        <div className="difficulty-cards">
          {(difficultyProgress || []).map((d) => {
            const pct = d.total > 0 ? Math.round((d.learned / d.total) * 100) : 0;
            const diffColors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
            return (
              <div key={d.label} className={`difficulty-card diff-${d.label}`}>
                <div className="diff-card-header">
                  <span className="diff-label">{d.label}</span>
                  <span className="diff-count">{d.learned}/{d.total}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${pct}%`, backgroundColor: diffColors[d.label] }}
                  />
                </div>
                <span className="diff-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Progress */}
      <div className="category-progress">
        <h3>Progress by Category</h3>
        <div className="category-bars">
          {categoryProgress?.map((cat) => {
            const pct = cat.total > 0 ? Math.round((cat.learned / cat.total) * 100) : 0;
            const colors = { daily: '#10b981', workplace: '#3b82f6', general: '#8b5cf6' };
            return (
              <div key={cat.category} className="category-bar-item">
                <div className="category-bar-label">
                  <span className="cat-name">{cat.category}</span>
                  <span className="cat-stat">{cat.learned}/{cat.total}</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: colors[cat.category] || '#6b7280'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-grid">
          <Link to="/learn" className="action-card">
            <BookOpen size={32} />
            <span>Start Learning</span>
          </Link>
          <Link to="/quiz" className="action-card">
            <Brain size={32} />
            <span>Take a Quiz</span>
          </Link>
          <Link to="/search" className="action-card">
            <Search size={32} />
            <span>Browse Words</span>
          </Link>
          <Link to="/progress" className="action-card">
            <Trophy size={32} />
            <span>View Stats</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

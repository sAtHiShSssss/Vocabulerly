import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { statsAPI, progressAPI } from '../services/api';
import {
  Trophy, Flame, Target, TrendingUp, Calendar,
  RotateCcw, Settings, Zap
} from 'lucide-react';

export default function ProgressStats() {
  const { summary, refreshSummary, showNotification } = useApp();
  const [history, setHistory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState(10);

  useEffect(() => {
    refreshSummary();
    loadStats();
  }, [refreshSummary]);

  const loadStats = async () => {
    try {
      const [histData, catData] = await Promise.all([
        statsAPI.getHistory(30),
        statsAPI.getCategories()
      ]);
      setHistory(histData.stats);
      setCategories(catData.categories);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleResetProgress = async () => {
    if (!window.confirm('Are you sure you want to reset all progress? This cannot be undone.')) return;
    try {
      await progressAPI.reset();
      refreshSummary();
      loadStats();
      showNotification('Progress reset successfully', 'info');
    } catch (err) {
      showNotification('Failed to reset progress', 'error');
    }
  };

  const handleUpdateGoal = async () => {
    try {
      await progressAPI.setDailyGoal(parseInt(newGoal));
      refreshSummary();
      setShowGoalModal(false);
      showNotification(`Daily goal updated to ${newGoal} words`, 'success');
    } catch (err) {
      showNotification('Failed to update daily goal', 'error');
    }
  };

  if (!summary) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading stats...</p>
      </div>
    );
  }

  const {
    totalWords, learned, difficult, skipped, remaining,
    accuracy, streak, todayStats
  } = summary;

  const colors = { daily: '#10b981', workplace: '#3b82f6', general: '#8b5cf6' };
  const diffColors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
  const difficultyProgress = summary.difficultyProgress || [];

  return (
    <div className="progress-page">
      <div className="progress-header">
        <h1>Your Progress</h1>
        <div className="progress-actions">
          <button className="icon-text-btn" onClick={() => { setNewGoal(streak?.daily_goal || 10); setShowGoalModal(true); }}>
            <Settings size={16} /> Set Goal
          </button>
          <button className="icon-text-btn danger" onClick={handleResetProgress}>
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>

      {/* Streak & Trophy */}
      <div className="trophy-section">
        <div className="trophy-card">
          <Flame size={36} className={streak?.current_streak > 0 ? 'flame-active' : ''} />
          <div>
            <h2>{streak?.current_streak || 0}</h2>
            <p>Current Streak</p>
          </div>
        </div>
        <div className="trophy-card">
          <Trophy size={36} className="trophy-icon" />
          <div>
            <h2>{streak?.longest_streak || 0}</h2>
            <p>Longest Streak</p>
          </div>
        </div>
        <div className="trophy-card">
          <Target size={36} />
          <div>
            <h2>{todayStats?.words_learned || 0}/{streak?.daily_goal || 10}</h2>
            <p>Today's Goal</p>
          </div>
        </div>
        <div className="trophy-card">
          <TrendingUp size={36} />
          <div>
            <h2>{accuracy}%</h2>
            <p>Accuracy</p>
          </div>
        </div>
      </div>

      {/* Main Progress */}
      <div className="main-progress-card">
        <h3>Overall Learning Progress</h3>
        <div className="big-progress">
          <div className="progress-ring">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke="#6366f1"
                strokeWidth="8"
                strokeDasharray={`${totalWords > 0 ? (learned / totalWords) * 326.7 : 0} 326.7`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="ring-text">
              <span className="ring-value">{totalWords > 0 ? Math.round((learned / totalWords) * 100) : 0}%</span>
              <span className="ring-label">Complete</span>
            </div>
          </div>
          <div className="progress-breakdown">
            <div className="breakdown-item">
              <span className="dot learned" />
              <span>Learned: {learned}</span>
            </div>
            <div className="breakdown-item">
              <span className="dot difficult" />
              <span>Difficult: {difficult}</span>
            </div>
            <div className="breakdown-item">
              <span className="dot skipped" />
              <span>Skipped: {skipped}</span>
            </div>
            <div className="breakdown-item">
              <span className="dot remaining" />
              <span>Remaining: {remaining}</span>
            </div>
            <div className="breakdown-item total">
              <strong>Total: {totalWords} words</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Difficulty Breakdown */}
      <div className="difficulty-breakdown">
        <h3><Zap size={18} /> Difficulty Breakdown</h3>
        <div className="difficulty-stats-grid">
          {difficultyProgress.map((d) => {
            const pct = d.total > 0 ? Math.round((d.learned / d.total) * 100) : 0;
            return (
              <div key={d.label} className={`diff-stat-card diff-${d.label}`}>
                <div className="diff-stat-header" style={{ borderLeftColor: diffColors[d.label] }}>
                  <h4>{d.label.charAt(0).toUpperCase() + d.label.slice(1)}</h4>
                  <span>{pct}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: diffColors[d.label] }} />
                </div>
                <div className="diff-stat-details">
                  <span>Total: {d.total}</span>
                  <span>Learned: {d.learned}</span>
                  <span>Difficult: {d.difficult}</span>
                  <span>Remaining: {d.total - d.learned - d.difficult - d.skipped}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="category-breakdown">
        <h3>Category Breakdown</h3>
        <div className="category-stats-grid">
          {categories.map((cat) => {
            const pct = cat.total > 0 ? Math.round((cat.learned / cat.total) * 100) : 0;
            return (
              <div key={cat.category} className="category-stat-card">
                <div className="category-stat-header" style={{ borderLeftColor: colors[cat.category] }}>
                  <h4>{cat.category}</h4>
                  <span>{pct}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: colors[cat.category] }} />
                </div>
                <div className="category-stat-details">
                  <span>Learned: {cat.learned}</span>
                  <span>Difficult: {cat.difficult}</span>
                  <span>Remaining: {cat.not_learned}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Learning History */}
      {history.length > 0 && (
        <div className="history-section">
          <h3><Calendar size={18} /> Recent Activity</h3>
          <div className="history-list">
            {history.map((day) => (
              <div key={day.date} className="history-item">
                <span className="history-date">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <div className="history-bars">
                  <span className="history-stat learned">{day.words_learned} learned</span>
                  <span className="history-stat reviewed">{day.words_reviewed} reviewed</span>
                  {day.quiz_total > 0 && (
                    <span className="history-stat quiz">Quiz: {day.quiz_score}/{day.quiz_total}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Set Daily Goal</h3>
            <p>How many words do you want to learn each day?</p>
            <div className="goal-options">
              {[5, 10, 15, 20, 30].map((g) => (
                <button
                  key={g}
                  className={`goal-btn ${newGoal === g ? 'active' : ''}`}
                  onClick={() => setNewGoal(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setShowGoalModal(false)}>Cancel</button>
              <button className="primary-btn" onClick={handleUpdateGoal}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

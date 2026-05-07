import { useState, useEffect } from 'react';
import { Volume2, Eye, EyeOff, Languages } from 'lucide-react';
import { useSpeech } from '../hooks/useSpeech';
import { useTranslation } from '../hooks/useTranslation';

export default function Flashcard({ word, onAction, showActions = true }) {
  const [revealed, setRevealed] = useState(false);
  const [tamilMeaning, setTamilMeaning] = useState('');
  const speak = useSpeech();
  const { getTranslation, langName, enabled } = useTranslation();

  // Reset revealed state when word changes
  useEffect(() => {
    setRevealed(false);
    setTamilMeaning('');
  }, [word?.id]);

  // Fetch translation when revealed
  useEffect(() => {
    if (revealed && word?.id && enabled) {
      getTranslation(word.id).then(t => {
        if (t) setTamilMeaning(t);
      });
    }
  }, [revealed, word?.id, enabled, getTranslation]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!showActions) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          setRevealed(r => !r);
          break;
        case '1':
          if (onAction) onAction('skipped');
          break;
        case '2':
          if (onAction) onAction('difficult');
          break;
        case '3':
          if (onAction) onAction('learned');
          break;
        case 'p':
          if (word) speak(word.word);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [word, onAction, showActions, speak]);

  if (!word) return null;

  const categoryColors = {
    daily: '#10b981',
    workplace: '#3b82f6',
    general: '#8b5cf6',
  };

  const difficultyInfo = {
    1: { label: 'Easy', color: '#22c55e' },
    2: { label: 'Medium', color: '#f59e0b' },
    3: { label: 'Hard', color: '#ef4444' },
  };
  const diff = difficultyInfo[word.difficulty_level] || difficultyInfo[2];

  const pronounce = () => {
    if (word) speak(word.word);
  };

  const handleAction = (action) => {
    if (onAction) onAction(action);
  };

  return (
    <div className="flashcard">
      <div className="flashcard-header">
        <span
          className="category-badge"
          style={{ backgroundColor: categoryColors[word.category] || '#6b7280' }}
        >
          {word.category}
        </span>
        <span
          className="difficulty-badge"
          style={{ backgroundColor: diff.color }}
        >
          {diff.label}
        </span>
        {word.part_of_speech && (
          <span className="pos-badge">{word.part_of_speech}</span>
        )}
      </div>

      <div className="flashcard-word">
        <h2>{word.word}</h2>
        <button className="icon-btn" onClick={pronounce} title="Pronounce">
          <Volume2 size={22} />
        </button>
      </div>

      {!revealed ? (
        <button className="reveal-btn" onClick={() => setRevealed(true)}>
          <Eye size={18} />
          <span>Reveal Meaning</span>
        </button>
      ) : (
        <div className="flashcard-details">
          <div className="flashcard-meaning">
            <h4>Meaning</h4>
            <p>{word.meaning}</p>
            {enabled && tamilMeaning && (
              <div className="translation-display">
                <span className="translation-label">
                  <Languages size={14} /> {langName}
                </span>
                <p className="translation-text">{tamilMeaning}</p>
              </div>
            )}
          </div>
          <div className="flashcard-example">
            <h4>Example</h4>
            <p className="example-text">"{word.example}"</p>
          </div>
          <button className="reveal-btn secondary" onClick={() => setRevealed(false)}>
            <EyeOff size={18} />
            <span>Hide</span>
          </button>
        </div>
      )}

      {showActions && (
        <div className="flashcard-actions">
          <button className="action-btn skip" onClick={() => handleAction('skipped')}>
            Skip <kbd>1</kbd>
          </button>
          <button className="action-btn difficult" onClick={() => handleAction('difficult')}>
            Difficult <kbd>2</kbd>
          </button>
          <button className="action-btn learned" onClick={() => handleAction('learned')}>
            Learned ✓ <kbd>3</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

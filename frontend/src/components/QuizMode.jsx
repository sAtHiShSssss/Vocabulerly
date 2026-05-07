import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { quizAPI, progressAPI } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import {
  Brain, CheckCircle, XCircle, ArrowRight, RotateCcw, Volume2, Zap,
  Shuffle, ThumbsUp, ThumbsDown, Ear, Link
} from 'lucide-react';

const DIFFICULTY_OPTIONS = [
  { key: 'all', label: 'All Levels' },
  { key: 'medium,hard', label: 'Medium + Hard' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];

const QUIZ_ICONS = {
  brain: <Brain size={36} />,
  blank: <span className="quiz-icon-text">_____</span>,
  shuffle: <Shuffle size={36} />,
  thumbsup: <ThumbsUp size={36} />,
  link: <Link size={36} />,
  ear: <Ear size={36} />,
};

const QUIZ_TYPES = [
  { key: 'mcq', icon: 'brain', title: 'Multiple Choice', desc: 'Match words with their correct meanings' },
  { key: 'fill-blank', icon: 'blank', title: 'Fill in the Blank', desc: 'Complete sentences with the correct word' },
  { key: 'reverse-mcq', icon: 'shuffle', title: 'Reverse MCQ', desc: 'See the meaning \u2014 pick the right word' },
  { key: 'true-false', icon: 'thumbsup', title: 'True or False', desc: 'Judge if the shown meaning is correct' },
  { key: 'match', icon: 'link', title: 'Word Matching', desc: 'Pair words with their meanings' },
  { key: 'spelling', icon: 'ear', title: 'Spelling Bee', desc: 'Listen & spell the word correctly' },
];

export default function QuizMode() {
  const { showNotification, refreshSummary } = useApp();
  const [quizType, setQuizType] = useState(null);
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('medium,hard');
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [fillAnswer, setFillAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);

  const [tfAnswer, setTfAnswer] = useState(null);

  const [matchPairs, setMatchPairs] = useState([]);
  const [matchSelectedWord, setMatchSelectedWord] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [matchWrong, setMatchWrong] = useState(null);
  const [matchShuffledMeanings, setMatchShuffledMeanings] = useState([]);
  const [matchTimer, setMatchTimer] = useState(0);
  const matchTimerRef = useRef(null);

  const [spellingInput, setSpellingInput] = useState('');
  const [hintUsed, setHintUsed] = useState(false);

  const speak = useSpeech();

  const startQuiz = useCallback(async (type) => {
    setLoading(true);
    setQuizType(type);
    setCurrentQ(0);
    setScore(0);
    setFinished(false);
    setSelected(null);
    setAnswered(false);
    setFillAnswer('');
    setTfAnswer(null);
    setMatchPairs([]);
    setMatchSelectedWord(null);
    setMatchedPairs([]);
    setMatchWrong(null);
    setMatchShuffledMeanings([]);
    setMatchTimer(0);
    setSpellingInput('');
    setHintUsed(false);
    if (matchTimerRef.current) clearInterval(matchTimerRef.current);

    try {
      const cat = category === 'all' ? undefined : category;
      const diff = difficulty === 'all' ? undefined : difficulty;
      let data;

      switch (type) {
        case 'mcq':         data = await quizAPI.getMCQ(10, cat, diff);        break;
        case 'fill-blank':  data = await quizAPI.getFillBlank(10, cat, diff);  break;
        case 'reverse-mcq': data = await quizAPI.getReverseMCQ(10, cat, diff); break;
        case 'true-false':  data = await quizAPI.getTrueFalse(10, cat, diff);  break;
        case 'match':       data = await quizAPI.getMatch(6, cat, diff);       break;
        case 'spelling':    data = await quizAPI.getSpelling(10, cat, diff);   break;
        default:            data = { questions: [] };
      }

      if (type === 'match') {
        if (!data.pairs || data.pairs.length < 3) {
          showNotification(data.message || 'Not enough learned words for matching.', 'info');
          setQuizType(null);
          setLoading(false);
          return;
        }
        setMatchPairs(data.pairs);
        setMatchShuffledMeanings([...data.pairs].sort(() => Math.random() - 0.5));
        setMatchTimer(0);
        matchTimerRef.current = setInterval(() => setMatchTimer(t => t + 1), 1000);
      } else {
        if (!data.questions || data.questions.length === 0) {
          showNotification(data.message || 'No learned words found. Learn some words first!', 'info');
          setQuizType(null);
          setLoading(false);
          return;
        }
        setQuestions(data.questions);
      }
    } catch (err) {
      showNotification('Failed to load quiz', 'error');
      setQuizType(null);
    } finally {
      setLoading(false);
    }
  }, [category, difficulty, showNotification]);

  const handleMCQSelect = async (option) => {
    if (answered) return;
    setSelected(option);
    setAnswered(true);
    const correct = option.correct;
    if (correct) setScore(s => s + 1);
    try {
      await progressAPI.recordQuiz(questions[currentQ].id, correct);
      refreshSummary();
    } catch (e) { console.error('Failed to record quiz result'); }
  };

  const handleFillSubmit = async () => {
    if (answered) return;
    setAnswered(true);
    const q = questions[currentQ];
    const correct = fillAnswer.toLowerCase().trim() === q.word.toLowerCase().trim();
    if (correct) setScore(s => s + 1);
    try {
      await progressAPI.recordQuiz(q.id, correct);
      refreshSummary();
    } catch (e) { console.error('Failed to record quiz result'); }
  };

  const handleTFAnswer = async (userSaidTrue) => {
    if (answered) return;
    setAnswered(true);
    setTfAnswer(userSaidTrue);
    const q = questions[currentQ];
    const correct = userSaidTrue === q.isTrue;
    if (correct) setScore(s => s + 1);
    try {
      await progressAPI.recordQuiz(q.id, correct);
      refreshSummary();
    } catch (e) { console.error('Failed to record quiz result'); }
  };

  const handleMatchWordClick = (pair) => {
    if (matchedPairs.find(p => p.id === pair.id)) return;
    setMatchSelectedWord(pair);
    setMatchWrong(null);
  };

  const handleMatchMeaningClick = async (pair) => {
    if (!matchSelectedWord || matchedPairs.find(p => p.id === pair.id)) return;
    if (matchSelectedWord.id === pair.id) {
      const newMatched = [...matchedPairs, pair];
      setMatchedPairs(newMatched);
      setMatchSelectedWord(null);
      setScore(s => s + 1);
      try {
        await progressAPI.recordQuiz(pair.id, true);
        refreshSummary();
      } catch (e) {}
      if (newMatched.length === matchPairs.length) {
        if (matchTimerRef.current) clearInterval(matchTimerRef.current);
        setFinished(true);
      }
    } else {
      setMatchWrong(pair.id);
      try { await progressAPI.recordQuiz(matchSelectedWord.id, false); } catch (e) {}
      setTimeout(() => { setMatchWrong(null); setMatchSelectedWord(null); }, 600);
    }
  };

  const handleSpellingSubmit = async () => {
    if (answered) return;
    setAnswered(true);
    const q = questions[currentQ];
    const correct = spellingInput.toLowerCase().trim() === q.word.toLowerCase().trim();
    if (correct) setScore(s => s + 1);
    try {
      await progressAPI.recordQuiz(q.id, correct);
      refreshSummary();
    } catch (e) { console.error('Failed to record quiz result'); }
  };

  const nextQuestion = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1);
      setSelected(null);
      setAnswered(false);
      setFillAnswer('');
      setTfAnswer(null);
      setSpellingInput('');
      setHintUsed(false);
    } else {
      setFinished(true);
    }
  };

  useEffect(() => {
    if (quizType === 'spelling' && questions[currentQ] && !loading && !finished) {
      const timer = setTimeout(() => speak(questions[currentQ].word), 300);
      return () => clearTimeout(timer);
    }
  }, [quizType, currentQ, questions, loading, finished]);

  useEffect(() => {
    return () => { if (matchTimerRef.current) clearInterval(matchTimerRef.current); };
  }, []);

  if (!quizType) {
    return (
      <div className="quiz-page">
        <h1>Quiz Mode</h1>
        <p className="subtitle">Test your knowledge on words you've already learned</p>

        <div className="quiz-learned-note">
          <CheckCircle size={16} />
          <span>Quizzes only include words you've marked as <strong>Learned</strong>. Keep learning to unlock more quiz questions!</span>
        </div>

        <div className="category-filter">
          {['all', 'daily', 'workplace', 'general'].map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="difficulty-filter">
          <Zap size={16} />
          <span className="filter-label">Difficulty:</span>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`filter-btn ${difficulty === opt.key ? 'active' : ''} diff-${opt.key.split(',')[0]}`}
              onClick={() => setDifficulty(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="quiz-type-grid six">
          {QUIZ_TYPES.map((qt) => (
            <button key={qt.key} className="quiz-type-card" onClick={() => startQuiz(qt.key)}>
              {QUIZ_ICONS[qt.icon]}
              <h3>{qt.title}</h3>
              <p>{qt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Generating quiz...</p>
      </div>
    );
  }

  if (finished) {
    const total = quizType === 'match' ? matchPairs.length : questions.length;
    const percentage = Math.round((score / total) * 100);
    const quizLabel = QUIZ_TYPES.find(q => q.key === quizType)?.title || 'Quiz';

    return (
      <div className="quiz-page">
        <div className="quiz-results">
          <h2>{quizLabel} Complete!</h2>
          <div className="score-circle">
            <span className="score-value">{percentage}%</span>
            <span className="score-label">{score}/{total} correct</span>
          </div>
          {quizType === 'match' && (
            <p className="match-time">Completed in {matchTimer}s</p>
          )}
          <p className="score-message">
            {percentage >= 80
              ? "\ud83c\udf89 Excellent! You're mastering these words!"
              : percentage >= 60
              ? "\ud83d\udc4d Good job! Keep practicing!"
              : "\ud83d\udcaa Keep learning! Practice makes perfect."}
          </p>
          <div className="quiz-results-actions">
            <button className="primary-btn" onClick={() => startQuiz(quizType)}>
              <RotateCcw size={16} /> Try Again
            </button>
            <button className="secondary-btn" onClick={() => setQuizType(null)}>
              Choose Different Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderHeader = (totalOverride) => {
    const total = totalOverride || questions.length;
    return (
      <>
        <div className="quiz-header">
          <span>Question {currentQ + 1} of {total}</span>
          <span>Score: {score}/{currentQ + (answered ? 1 : 0)}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((currentQ + 1) / total) * 100}%` }} />
        </div>
      </>
    );
  };

  const renderNextBtn = () => (
    answered && (
      <button className="primary-btn next-btn" onClick={nextQuestion}>
        {currentQ < questions.length - 1 ? <>Next <ArrowRight size={16} /></> : 'See Results'}
      </button>
    )
  );

  if (quizType === 'mcq') {
    const q = questions[currentQ];
    return (
      <div className="quiz-page">
        {renderHeader()}
        <div className="quiz-question">
          <div className="quiz-word">
            <h2>{q.word}</h2>
            <button className="icon-btn" onClick={() => speak(q.word)}><Volume2 size={20} /></button>
          </div>
          {q.part_of_speech && <span className="pos-badge">{q.part_of_speech}</span>}
          <p className="quiz-prompt">What is the meaning of this word?</p>
        </div>
        <div className="mcq-options">
          {q.options.map((option, idx) => {
            let className = 'mcq-option';
            if (answered) {
              if (option.correct) className += ' correct';
              else if (selected?.id === option.id) className += ' wrong';
            } else if (selected?.id === option.id) {
              className += ' selected';
            }
            return (
              <button key={idx} className={className} onClick={() => handleMCQSelect(option)} disabled={answered}>
                <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                <span className="option-text">{option.meaning}</span>
                {answered && option.correct && <CheckCircle size={18} className="option-icon" />}
                {answered && !option.correct && selected?.id === option.id && <XCircle size={18} className="option-icon" />}
              </button>
            );
          })}
        </div>
        {renderNextBtn()}
      </div>
    );
  }

  if (quizType === 'fill-blank') {
    const q = questions[currentQ];
    return (
      <div className="quiz-page">
        {renderHeader()}
        <div className="quiz-question fill-blank">
          <p className="quiz-prompt">Fill in the blank:</p>
          <p className="fill-sentence">"{q.sentence}"</p>
          <p className="fill-hint"><strong>Meaning:</strong> {q.meaning}</p>
        </div>
        <div className="fill-input-group">
          <input
            type="text" value={fillAnswer} onChange={e => setFillAnswer(e.target.value)}
            placeholder="Type the word..." disabled={answered}
            onKeyDown={e => e.key === 'Enter' && !answered && fillAnswer && handleFillSubmit()}
            autoFocus
          />
          {!answered && (
            <button className="primary-btn" onClick={handleFillSubmit} disabled={!fillAnswer}>Check</button>
          )}
        </div>
        {answered && (
          <div className={`fill-result ${fillAnswer.toLowerCase().trim() === q.word.toLowerCase() ? 'correct' : 'wrong'}`}>
            {fillAnswer.toLowerCase().trim() === q.word.toLowerCase()
              ? <p><CheckCircle size={18} /> Correct!</p>
              : <p><XCircle size={18} /> The correct word is: <strong>{q.word}</strong></p>}
            <p className="original-sentence">"{q.original_sentence}"</p>
            {renderNextBtn()}
          </div>
        )}
      </div>
    );
  }

  if (quizType === 'reverse-mcq') {
    const q = questions[currentQ];
    return (
      <div className="quiz-page">
        {renderHeader()}
        <div className="quiz-question">
          <p className="quiz-prompt reverse-label">Which word matches this meaning?</p>
          <p className="reverse-meaning">"{q.meaning}"</p>
          {q.part_of_speech && <span className="pos-badge">{q.part_of_speech}</span>}
        </div>
        <div className="mcq-options">
          {q.options.map((option, idx) => {
            let className = 'mcq-option';
            if (answered) {
              if (option.correct) className += ' correct';
              else if (selected?.id === option.id) className += ' wrong';
            } else if (selected?.id === option.id) {
              className += ' selected';
            }
            return (
              <button key={idx} className={className} onClick={() => handleMCQSelect(option)} disabled={answered}>
                <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                <span className="option-text">{option.word}</span>
                {answered && option.correct && <CheckCircle size={18} className="option-icon" />}
                {answered && !option.correct && selected?.id === option.id && <XCircle size={18} className="option-icon" />}
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`fill-result ${selected?.correct ? 'correct' : 'wrong'}`} style={{ marginTop: 12 }}>
            <p>{selected?.correct ? <><CheckCircle size={18} /> Correct!</> : <><XCircle size={18} /> The correct word is: <strong>{q.correctWord}</strong></>}</p>
          </div>
        )}
        {renderNextBtn()}
      </div>
    );
  }

  if (quizType === 'true-false') {
    const q = questions[currentQ];
    const userCorrect = answered ? (tfAnswer === q.isTrue) : null;

    return (
      <div className="quiz-page">
        {renderHeader()}
        <div className="quiz-question tf-question">
          <div className="quiz-word">
            <h2>{q.word}</h2>
            <button className="icon-btn" onClick={() => speak(q.word)}><Volume2 size={20} /></button>
          </div>
          {q.part_of_speech && <span className="pos-badge">{q.part_of_speech}</span>}
          <p className="quiz-prompt">Is this the correct meaning?</p>
          <p className="tf-meaning">"{q.displayedMeaning}"</p>
        </div>

        <div className="tf-buttons">
          <button
            className={`tf-btn true ${answered ? (q.isTrue ? 'correct' : tfAnswer === true ? 'wrong' : '') : ''}`}
            onClick={() => handleTFAnswer(true)}
            disabled={answered}
          >
            <ThumbsUp size={22} /> True
          </button>
          <button
            className={`tf-btn false ${answered ? (!q.isTrue ? 'correct' : tfAnswer === false ? 'wrong' : '') : ''}`}
            onClick={() => handleTFAnswer(false)}
            disabled={answered}
          >
            <ThumbsDown size={22} /> False
          </button>
        </div>

        {answered && (
          <div className={`fill-result ${userCorrect ? 'correct' : 'wrong'}`} style={{ marginTop: 16 }}>
            {userCorrect
              ? <p><CheckCircle size={18} /> Correct!</p>
              : <p><XCircle size={18} /> Wrong! The real meaning is: <strong>"{q.correctMeaning}"</strong></p>}
          </div>
        )}
        {renderNextBtn()}
      </div>
    );
  }

  if (quizType === 'match') {
    return (
      <div className="quiz-page">
        <div className="quiz-header">
          <span>Matched: {matchedPairs.length}/{matchPairs.length}</span>
          <span className="match-timer-display">\u23f1 {matchTimer}s</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(matchedPairs.length / matchPairs.length) * 100}%` }} />
        </div>

        <div className="quiz-question" style={{ padding: '16px 20px' }}>
          <p className="quiz-prompt">Tap a word, then tap its matching meaning</p>
        </div>

        <div className="match-container">
          <div className="match-column">
            <h4>Words</h4>
            {matchPairs.map(pair => {
              const isMatched = matchedPairs.find(p => p.id === pair.id);
              const isSelected = matchSelectedWord?.id === pair.id;
              return (
                <button
                  key={pair.id}
                  className={`match-item word ${isMatched ? 'matched' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleMatchWordClick(pair)}
                  disabled={!!isMatched}
                >
                  {pair.word}
                </button>
              );
            })}
          </div>
          <div className="match-column">
            <h4>Meanings</h4>
            {matchShuffledMeanings.map(pair => {
              const isMatched = matchedPairs.find(p => p.id === pair.id);
              const isWrong = matchWrong === pair.id;
              return (
                <button
                  key={pair.id}
                  className={`match-item meaning ${isMatched ? 'matched' : ''} ${isWrong ? 'wrong-flash' : ''}`}
                  onClick={() => handleMatchMeaningClick(pair)}
                  disabled={!!isMatched}
                >
                  {pair.meaning}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (quizType === 'spelling') {
    const q = questions[currentQ];
    const isCorrect = answered && spellingInput.toLowerCase().trim() === q.word.toLowerCase().trim();

    return (
      <div className="quiz-page">
        {renderHeader()}
        <div className="quiz-question spelling-q">
          <button className="spelling-play-btn" onClick={() => speak(q.word)}>
            <Volume2 size={32} />
            <span>Play Word</span>
          </button>
          <p className="fill-hint"><strong>Meaning:</strong> {q.meaning}</p>
          {q.part_of_speech && <span className="pos-badge">{q.part_of_speech}</span>}
          {!hintUsed && !answered && (
            <button className="hint-btn" onClick={() => setHintUsed(true)}>
              Show hint ({q.letterCount} letters)
            </button>
          )}
          {hintUsed && !answered && (
            <p className="spelling-hint">
              Starts with "<strong>{q.firstLetter}</strong>" \u2014 {q.letterCount} letters
            </p>
          )}
        </div>

        <div className="fill-input-group">
          <input
            type="text" value={spellingInput} onChange={e => setSpellingInput(e.target.value)}
            placeholder="Spell the word..." disabled={answered}
            onKeyDown={e => e.key === 'Enter' && !answered && spellingInput && handleSpellingSubmit()}
            autoFocus
          />
          {!answered && (
            <button className="primary-btn" onClick={handleSpellingSubmit} disabled={!spellingInput}>Check</button>
          )}
        </div>

        {answered && (
          <div className={`fill-result ${isCorrect ? 'correct' : 'wrong'}`}>
            {isCorrect
              ? <p><CheckCircle size={18} /> Correct!</p>
              : <p><XCircle size={18} /> Correct spelling: <strong>{q.word}</strong></p>}
          </div>
        )}
        {renderNextBtn()}
      </div>
    );
  }

  return null;
}

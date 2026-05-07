import { useState, useEffect, useCallback } from 'react';
import { wordsAPI } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { useTranslation } from '../hooks/useTranslation';
import { useApp } from '../context/AppContext';
import {
  Search, Filter, Volume2, ChevronLeft, ChevronRight,
  Zap, BookOpen, Plus, ArrowRight, Sparkles, PenLine,
  Edit3, Trash2, Save, X, Languages
} from 'lucide-react';

const DIFF_LABELS = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const DIFF_COLORS = { 1: '#22c55e', 2: '#f59e0b', 3: '#ef4444' };

export default function SearchFilter() {
  const { showNotification, refreshSummary } = useApp();
  const speak = useSpeech();
  const { getTranslation, langName, enabled: translationEnabled } = useTranslation();

  // --- Translation cache for expanded words ---
  const [translations, setTranslations] = useState({});

  // --- Tab toggle: 'lookup' or 'add' ---
  const [activeTab, setActiveTab] = useState('lookup');

  // --- Word Lookup State ---
  const [lookupInput, setLookupInput] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // --- Manual Add State ---
  const [addWord, setAddWord] = useState('');
  const [addMeaning, setAddMeaning] = useState('');
  const [addExample, setAddExample] = useState('');
  const [addPoS, setAddPoS] = useState('');
  const [addCategory, setAddCategory] = useState('general');
  const [addDifficulty, setAddDifficulty] = useState('2');
  const [addLoading, setAddLoading] = useState(false);
  const [addResult, setAddResult] = useState(null);
  const [addError, setAddError] = useState('');

  // --- Browse State ---
  const [words, setWords] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // --- Inline Edit State ---
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);

  // --- Fetch translation when word card is expanded ---
  useEffect(() => {
    if (expandedId && translationEnabled) {
      getTranslation(expandedId).then(t => {
        if (t) setTranslations(prev => ({ ...prev, [expandedId]: t }));
      });
    }
  }, [expandedId, translationEnabled, getTranslation]);

  // --- Lookup handler ---
  const handleLookup = async (e) => {
    e?.preventDefault();
    const word = lookupInput.trim();
    if (!word) return;

    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);

    try {
      const data = await wordsAPI.lookup(word);
      setLookupResult(data);
      if (data.added) {
        showNotification(`"${data.word.word}" added to your dictionary!`, 'success');
        refreshSummary();
      }
    } catch (err) {
      setLookupError(
        err.message?.includes('not found')
          ? `No definition found for "${word}". Check the spelling and try again.`
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setLookupLoading(false);
    }
  };

  // --- Manual Add handler ---
  const handleAddWord = async (e) => {
    e?.preventDefault();
    if (!addWord.trim() || !addMeaning.trim() || !addExample.trim()) return;

    setAddLoading(true);
    setAddError('');
    setAddResult(null);

    try {
      const data = await wordsAPI.addWord({
        word: addWord.trim(),
        meaning: addMeaning.trim(),
        example: addExample.trim(),
        part_of_speech: addPoS.trim() || undefined,
        category: addCategory,
        difficulty_level: parseInt(addDifficulty),
      });
      setAddResult(data);
      showNotification(`"${data.word.word}" added to your dictionary!`, 'success');
      refreshSummary();
      // Reset form
      setAddWord('');
      setAddMeaning('');
      setAddExample('');
      setAddPoS('');
      setAddCategory('general');
      setAddDifficulty('2');
      // Refresh browse list
      fetchWords();
    } catch (err) {
      setAddError(
        err.message?.includes('already exists')
          ? 'This word already exists in your dictionary.'
          : 'Failed to add word. Please try again.'
      );
    } finally {
      setAddLoading(false);
    }
  };

  // --- Browse fetch ---
  const fetchWords = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (category !== 'all') params.category = category;
      if (difficulty !== 'all') params.difficulty = difficulty;
      if (status !== 'all') params.status = status;

      const data = await wordsAPI.getAll(params);
      setWords(data.words);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch words:', err);
    } finally {
      setLoading(false);
    }
  }, [search, category, difficulty, status, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWords();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchWords]);

  useEffect(() => {
    setPage(1);
  }, [search, category, difficulty, status]);

  // --- Start editing a word ---
  const startEdit = (word, e) => {
    e.stopPropagation();
    setEditingId(word.id);
    setEditFields({
      meaning: word.meaning,
      example: word.example,
      part_of_speech: word.part_of_speech || '',
      category: word.category,
      difficulty_level: String(word.difficulty_level),
    });
  };

  const cancelEdit = (e) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditFields({});
  };

  const saveEdit = async (wordId, e) => {
    e.stopPropagation();
    setEditLoading(true);
    try {
      await wordsAPI.updateWord(wordId, {
        meaning: editFields.meaning,
        example: editFields.example,
        part_of_speech: editFields.part_of_speech || null,
        category: editFields.category,
        difficulty_level: parseInt(editFields.difficulty_level),
      });
      showNotification('Word updated successfully!', 'success');
      setEditingId(null);
      setEditFields({});
      fetchWords();
      refreshSummary();
    } catch (err) {
      showNotification(err.message || 'Failed to update word', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (word, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${word.word}" from your dictionary? This cannot be undone.`)) return;
    setDeleteLoading(word.id);
    try {
      await wordsAPI.deleteWord(word.id);
      showNotification(`"${word.word}" deleted from dictionary`, 'info');
      setExpandedId(null);
      fetchWords();
      refreshSummary();
    } catch (err) {
      showNotification('Failed to delete word', 'error');
    } finally {
      setDeleteLoading(null);
    }
  };

  const statusColors = {
    learned: '#10b981',
    difficult: '#f59e0b',
    skipped: '#6b7280',
    not_learned: '#e5e7eb',
  };

  const categoryColors = {
    daily: '#10b981',
    workplace: '#3b82f6',
    general: '#8b5cf6',
  };

  return (
    <div className="search-filter-page">
      <h1>Browse & Lookup</h1>

      {/* ====== WORD LOOKUP / ADD SECTION ====== */}
      <div className="lookup-section">
        {/* Tab toggle */}
        <div className="lookup-tabs">
          <button
            className={`lookup-tab ${activeTab === 'lookup' ? 'active' : ''}`}
            onClick={() => setActiveTab('lookup')}
          >
            <Sparkles size={16} /> Look Up Word
          </button>
          <button
            className={`lookup-tab ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            <PenLine size={16} /> Add Your Own Word
          </button>
        </div>

        {/* ===== LOOKUP TAB ===== */}
        {activeTab === 'lookup' && (
          <div className="lookup-tab-content">
            <p className="lookup-description">Enter any English word to get its meaning. New words are automatically added to your dictionary.</p>

            <form className="lookup-form" onSubmit={handleLookup}>
              <div className="lookup-input-group">
                <BookOpen size={18} className="lookup-icon" />
                <input
                  type="text"
                  placeholder="Type any word... e.g. serendipity"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="submit"
                  className="lookup-btn"
                  disabled={lookupLoading || !lookupInput.trim()}
                >
                  {lookupLoading ? (
                    <span className="spinner-small" />
                  ) : (
                    <>Look up <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </form>

            {lookupResult && (
              <div className={`lookup-result ${lookupResult.added ? 'lookup-result-new' : ''}`}>
                {lookupResult.added && (
                  <div className="lookup-added-badge">
                    <Plus size={14} /> New word added to dictionary
                  </div>
                )}
                <div className="lookup-result-header">
                  <h3>{lookupResult.word.word}</h3>
                  <button
                    className="icon-btn"
                    onClick={() => speak(lookupResult.word.word)}
                    title="Pronounce"
                  >
                    <Volume2 size={18} />
                  </button>
                  {lookupResult.word.part_of_speech && (
                    <span className="pos-badge">{lookupResult.word.part_of_speech}</span>
                  )}
                  <span
                    className="difficulty-badge"
                    style={{ backgroundColor: DIFF_COLORS[lookupResult.word.difficulty_level] }}
                  >
                    {DIFF_LABELS[lookupResult.word.difficulty_level]}
                  </span>
                </div>
                <div className="lookup-result-body">
                  <p className="lookup-meaning"><strong>Meaning:</strong> {lookupResult.word.meaning}</p>
                  <p className="lookup-example"><strong>Example:</strong> "{lookupResult.word.example}"</p>
                </div>
                {lookupResult.source === 'local' && (
                  <p className="lookup-source-note">This word is already in your dictionary.</p>
                )}
              </div>
            )}

            {lookupError && (
              <div className="lookup-error">
                <p>{lookupError}</p>
              </div>
            )}
          </div>
        )}

        {/* ===== ADD WORD TAB ===== */}
        {activeTab === 'add' && (
          <div className="lookup-tab-content">
            <p className="lookup-description">Add a custom word with your own meaning and example sentence.</p>

            <form className="add-word-form" onSubmit={handleAddWord}>
              <div className="add-field">
                <label htmlFor="add-word">Word <span className="required">*</span></label>
                <input
                  id="add-word"
                  type="text"
                  placeholder="e.g. wanderlust"
                  value={addWord}
                  onChange={(e) => setAddWord(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>

              <div className="add-field">
                <label htmlFor="add-meaning">Meaning <span className="required">*</span></label>
                <textarea
                  id="add-meaning"
                  placeholder="e.g. a strong desire to travel and explore the world"
                  value={addMeaning}
                  onChange={(e) => setAddMeaning(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="add-field">
                <label htmlFor="add-example">Example Sentence <span className="required">*</span></label>
                <textarea
                  id="add-example"
                  placeholder="e.g. Her wanderlust led her to visit over 30 countries."
                  value={addExample}
                  onChange={(e) => setAddExample(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="add-field-row">
                <div className="add-field">
                  <label htmlFor="add-pos">Part of Speech</label>
                  <select id="add-pos" value={addPoS} onChange={(e) => setAddPoS(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="noun">Noun</option>
                    <option value="verb">Verb</option>
                    <option value="adjective">Adjective</option>
                    <option value="adverb">Adverb</option>
                    <option value="preposition">Preposition</option>
                    <option value="conjunction">Conjunction</option>
                    <option value="interjection">Interjection</option>
                  </select>
                </div>
                <div className="add-field">
                  <label htmlFor="add-cat">Category</label>
                  <select id="add-cat" value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                    <option value="general">General</option>
                    <option value="daily">Daily</option>
                    <option value="workplace">Workplace</option>
                  </select>
                </div>
                <div className="add-field">
                  <label htmlFor="add-diff">Difficulty</label>
                  <select id="add-diff" value={addDifficulty} onChange={(e) => setAddDifficulty(e.target.value)}>
                    <option value="1">Easy</option>
                    <option value="2">Medium</option>
                    <option value="3">Hard</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="lookup-btn add-submit-btn"
                disabled={addLoading || !addWord.trim() || !addMeaning.trim() || !addExample.trim()}
              >
                {addLoading ? (
                  <span className="spinner-small" />
                ) : (
                  <><Plus size={16} /> Add to Dictionary</>
                )}
              </button>
            </form>

            {addResult && (
              <div className="lookup-result lookup-result-new">
                <div className="lookup-added-badge">
                  <Plus size={14} /> Word added successfully
                </div>
                <div className="lookup-result-header">
                  <h3>{addResult.word.word}</h3>
                  <button className="icon-btn" onClick={() => speak(addResult.word.word)} title="Pronounce">
                    <Volume2 size={18} />
                  </button>
                  {addResult.word.part_of_speech && (
                    <span className="pos-badge">{addResult.word.part_of_speech}</span>
                  )}
                </div>
                <div className="lookup-result-body">
                  <p className="lookup-meaning"><strong>Meaning:</strong> {addResult.word.meaning}</p>
                  <p className="lookup-example"><strong>Example:</strong> "{addResult.word.example}"</p>
                </div>
              </div>
            )}

            {addError && (
              <div className="lookup-error">
                <p>{addError}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====== BROWSE SECTION ====== */}
      <div className="browse-divider">
        <span>Browse Dictionary</span>
      </div>

      <div className="search-bar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search words, meanings, or examples..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="clear-search" onClick={() => setSearch('')}>&times;</button>
        )}
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <Filter size={16} />
          <span>Category:</span>
          {['all', 'daily', 'workplace', 'general'].map((cat) => (
            <button
              key={cat}
              className={`filter-btn small ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <Zap size={16} />
          <span>Difficulty:</span>
          {['all', 'easy', 'medium', 'hard'].map((d) => (
            <button
              key={d}
              className={`filter-btn small ${difficulty === d ? 'active' : ''} diff-${d}`}
              onClick={() => setDifficulty(d)}
            >
              {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span>Status:</span>
          {['all', 'learned', 'not_learned', 'difficult', 'skipped'].map((s) => (
            <button
              key={s}
              className={`filter-btn small ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {pagination && (
        <div className="results-count">
          Showing {words.length} of {pagination.total} words
          {search && <span className="search-query"> for &ldquo;{search}&rdquo;</span>}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
        </div>
      ) : words.length === 0 ? (
        <div className="empty-state">
          <p>No words found matching your criteria.</p>
          {search && (
            <p className="empty-hint">
              Try the <strong>Word Lookup</strong> above to find &ldquo;{search}&rdquo; and add it to your dictionary.
            </p>
          )}
        </div>
      ) : (
        <div className="word-list">
          {words.map((word) => (
            <div
              key={word.id}
              className={`word-card ${expandedId === word.id ? 'expanded' : ''}`}
              onClick={() => setExpandedId(expandedId === word.id ? null : word.id)}
            >
              <div className="word-card-header">
                <div className="word-card-left">
                  <span className="word-text">{word.word}</span>
                  {word.part_of_speech && (
                    <span className="pos-badge small">{word.part_of_speech}</span>
                  )}
                </div>
                <div className="word-card-right">
                  <span
                    className="difficulty-dot"
                    style={{ backgroundColor: DIFF_COLORS[word.difficulty_level] }}
                    title={DIFF_LABELS[word.difficulty_level]}
                  />
                  <span
                    className="category-dot"
                    style={{ backgroundColor: categoryColors[word.category] }}
                    title={word.category}
                  />
                  <span
                    className="status-dot"
                    style={{ backgroundColor: statusColors[word.learn_status] }}
                    title={word.learn_status}
                  />
                  <button
                    className="icon-btn small"
                    onClick={(e) => { e.stopPropagation(); speak(word.word); }}
                  >
                    <Volume2 size={14} />
                  </button>
                </div>
              </div>
              {expandedId === word.id && (
                <div className="word-card-details" onClick={(e) => e.stopPropagation()}>
                  {editingId === word.id ? (
                    /* ===== EDIT MODE ===== */
                    <div className="word-edit-form">
                      <div className="add-field">
                        <label>Meaning</label>
                        <textarea
                          value={editFields.meaning}
                          onChange={(e) => setEditFields({ ...editFields, meaning: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="add-field">
                        <label>Example Sentence</label>
                        <textarea
                          value={editFields.example}
                          onChange={(e) => setEditFields({ ...editFields, example: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="add-field-row">
                        <div className="add-field">
                          <label>Part of Speech</label>
                          <select
                            value={editFields.part_of_speech}
                            onChange={(e) => setEditFields({ ...editFields, part_of_speech: e.target.value })}
                          >
                            <option value="">Select...</option>
                            <option value="noun">Noun</option>
                            <option value="verb">Verb</option>
                            <option value="adjective">Adjective</option>
                            <option value="adverb">Adverb</option>
                            <option value="preposition">Preposition</option>
                            <option value="conjunction">Conjunction</option>
                            <option value="interjection">Interjection</option>
                          </select>
                        </div>
                        <div className="add-field">
                          <label>Category</label>
                          <select
                            value={editFields.category}
                            onChange={(e) => setEditFields({ ...editFields, category: e.target.value })}
                          >
                            <option value="general">General</option>
                            <option value="daily">Daily</option>
                            <option value="workplace">Workplace</option>
                          </select>
                        </div>
                        <div className="add-field">
                          <label>Difficulty</label>
                          <select
                            value={editFields.difficulty_level}
                            onChange={(e) => setEditFields({ ...editFields, difficulty_level: e.target.value })}
                          >
                            <option value="1">Easy</option>
                            <option value="2">Medium</option>
                            <option value="3">Hard</option>
                          </select>
                        </div>
                      </div>
                      <div className="word-edit-actions">
                        <button
                          className="edit-save-btn"
                          onClick={(e) => saveEdit(word.id, e)}
                          disabled={editLoading || !editFields.meaning?.trim() || !editFields.example?.trim()}
                        >
                          {editLoading ? <span className="spinner-small" /> : <><Save size={14} /> Save</>}
                        </button>
                        <button className="edit-cancel-btn" onClick={cancelEdit}>
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ===== VIEW MODE ===== */
                    <>
                      <p className="meaning"><strong>Meaning:</strong> {word.meaning}</p>
                      {translationEnabled && translations[word.id] && (
                        <div className="translation-display compact">
                          <span className="translation-label">
                            <Languages size={12} /> {langName}
                          </span>
                          <span className="translation-text">{translations[word.id]}</span>
                        </div>
                      )}
                      <p className="example"><strong>Example:</strong> "{word.example}"</p>
                      <div className="word-meta">
                        <span className="category-badge small" style={{ backgroundColor: categoryColors[word.category] }}>
                          {word.category}
                        </span>
                        <span className="difficulty-badge small" style={{ backgroundColor: DIFF_COLORS[word.difficulty_level] }}>
                          {DIFF_LABELS[word.difficulty_level]}
                        </span>
                        <span className={`status-badge ${word.learn_status}`}>
                          {word.learn_status?.replace('_', ' ')}
                        </span>
                        {word.times_reviewed > 0 && (
                          <span className="review-count">Reviewed {word.times_reviewed}x</span>
                        )}
                      </div>
                      <div className="word-card-actions">
                        <button className="word-action-btn edit" onClick={(e) => startEdit(word, e)}>
                          <Edit3 size={14} /> Edit
                        </button>
                        <button
                          className="word-action-btn delete"
                          onClick={(e) => handleDelete(word, e)}
                          disabled={deleteLoading === word.id}
                        >
                          {deleteLoading === word.id
                            ? <span className="spinner-small" />
                            : <><Trash2 size={14} /> Delete</>
                          }
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="page-info">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            className="page-btn"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

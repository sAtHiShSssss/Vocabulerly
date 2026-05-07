const BASE_URL = '/api';

async function request(url, options = {}) {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

// Words API
export const wordsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/words?${query}`);
  },
  getNext: (category, difficulty) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    return request(`/words/next?${params}`);
  },
  getBatch: (count = 10, category, difficulty) => {
    const params = new URLSearchParams({ count });
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    return request(`/words/batch?${params}`);
  },
  getById: (id) => request(`/words/${id}`),
  getWordOfTheDay: () => request('/words/wotd'),
  lookup: (word) => request(`/words/lookup/${encodeURIComponent(word.trim())}`),
  addWord: ({ word, meaning, example, part_of_speech, category, difficulty_level }) =>
    request('/words', {
      method: 'POST',
      body: JSON.stringify({ word, meaning, example, part_of_speech, category, difficulty_level }),
    }),
  updateWord: (id, fields) =>
    request(`/words/${id}`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    }),
  deleteWord: (id) =>
    request(`/words/${id}`, { method: 'DELETE' }),
};

// Progress API
export const progressAPI = {
  update: (wordId, status) =>
    request('/progress/update', {
      method: 'POST',
      body: JSON.stringify({ word_id: wordId, status }),
    }),
  recordQuiz: (wordId, correct) =>
    request('/progress/quiz', {
      method: 'POST',
      body: JSON.stringify({ word_id: wordId, correct }),
    }),
  getSummary: () => request('/progress/summary'),
  setDailyGoal: (goal) =>
    request('/progress/daily-goal', {
      method: 'PUT',
      body: JSON.stringify({ goal }),
    }),
  reset: () =>
    request('/progress/reset', { method: 'POST' }),
};

// Quiz API
export const quizAPI = {
  getMCQ: (count = 10, category, difficulty) => {
    const params = new URLSearchParams({ count });
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    return request(`/quiz/mcq?${params}`);
  },
  getFillBlank: (count = 10, category, difficulty) => {
    const params = new URLSearchParams({ count });
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    return request(`/quiz/fill-blank?${params}`);
  },
  getReverseMCQ: (count = 10, category, difficulty) => {
    const params = new URLSearchParams({ count });
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    return request(`/quiz/reverse-mcq?${params}`);
  },
  getTrueFalse: (count = 10, category, difficulty) => {
    const params = new URLSearchParams({ count });
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    return request(`/quiz/true-false?${params}`);
  },
  getMatch: (count = 6, category, difficulty) => {
    const params = new URLSearchParams({ count });
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    return request(`/quiz/match?${params}`);
  },
  getSpelling: (count = 10, category, difficulty) => {
    const params = new URLSearchParams({ count });
    if (category) params.append('category', category);
    if (difficulty) params.append('difficulty', difficulty);
    return request(`/quiz/spelling?${params}`);
  },
  getReview: (status = 'learned', count = 10) => {
    const params = new URLSearchParams({ status, count });
    return request(`/quiz/review?${params}`);
  },
};

// Stats API
export const statsAPI = {
  getHistory: (days = 30) => request(`/stats/history?days=${days}`),
  getCategories: () => request('/stats/categories'),
};

// Translation API
export const translateAPI = {
  getLanguages: () => request('/translate/languages'),
  getSettings: () => request('/translate/settings'),
  updateSettings: (language) =>
    request('/translate/settings', {
      method: 'PUT',
      body: JSON.stringify({ language }),
    }),
  getWord: (wordId, lang) => {
    const params = lang ? `?lang=${lang}` : '';
    return request(`/translate/word/${wordId}${params}`);
  },
  getBatch: (wordIds, lang) =>
    request('/translate/batch', {
      method: 'POST',
      body: JSON.stringify({ word_ids: wordIds, lang }),
    }),
};

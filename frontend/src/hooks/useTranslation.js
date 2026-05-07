import { useState, useEffect, useCallback, useRef } from 'react';
import { translateAPI } from '../services/api';

// Global cache shared across all hook instances
const translationCache = new Map();

export function useTranslation() {
  const [nativeLang, setNativeLang] = useState(null);
  const [langName, setLangName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [languages, setLanguages] = useState({});
  const loadedRef = useRef(false);

  // Load user's language preference on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    translateAPI.getSettings()
      .then(data => {
        setNativeLang(data.language);
      })
      .catch(() => {
        setNativeLang('ta'); // Default Tamil
      });

    translateAPI.getLanguages()
      .then(data => {
        setLanguages(data.languages);
      })
      .catch(() => {});
  }, []);

  // Update langName when nativeLang or languages change
  useEffect(() => {
    if (nativeLang && languages[nativeLang]) {
      setLangName(languages[nativeLang]);
    }
  }, [nativeLang, languages]);

  // Change language preference
  const changeLanguage = useCallback(async (lang) => {
    try {
      await translateAPI.updateSettings(lang);
      setNativeLang(lang);
      // Clear cache when language changes
      translationCache.clear();
    } catch (err) {
      console.error('Failed to update language:', err);
    }
  }, []);

  // Get translation for a single word (with cache)
  const getTranslation = useCallback(async (wordId) => {
    if (!enabled || !nativeLang || !wordId) return null;

    const cacheKey = `${wordId}_${nativeLang}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey);
    }

    try {
      const data = await translateAPI.getWord(wordId, nativeLang);
      translationCache.set(cacheKey, data.translated_meaning);
      return data.translated_meaning;
    } catch (err) {
      return null;
    }
  }, [enabled, nativeLang]);

  // Get translations for a batch of words
  const getBatchTranslations = useCallback(async (wordIds) => {
    if (!enabled || !nativeLang || !wordIds?.length) return {};

    // Check which are already cached
    const results = {};
    const uncachedIds = [];

    for (const id of wordIds) {
      const cacheKey = `${id}_${nativeLang}`;
      if (translationCache.has(cacheKey)) {
        results[id] = translationCache.get(cacheKey);
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) return results;

    try {
      const data = await translateAPI.getBatch(uncachedIds, nativeLang);
      if (data.translations) {
        for (const [id, meaning] of Object.entries(data.translations)) {
          const cacheKey = `${id}_${nativeLang}`;
          translationCache.set(cacheKey, meaning);
          results[id] = meaning;
        }
      }
    } catch (err) {
      console.error('Batch translation failed:', err);
    }

    return results;
  }, [enabled, nativeLang]);

  return {
    nativeLang,
    langName,
    enabled,
    setEnabled,
    languages,
    changeLanguage,
    getTranslation,
    getBatchTranslations,
  };
}

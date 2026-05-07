import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { progressAPI } from '../services/api';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeDifficulty, setActiveDifficulty] = useState('medium,hard');
  const [notification, setNotification] = useState(null);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await progressAPI.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const refreshSummary = useCallback(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <AppContext.Provider
      value={{
        summary,
        loading,
        activeCategory,
        setActiveCategory,
        activeDifficulty,
        setActiveDifficulty,
        notification,
        showNotification,
        refreshSummary,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}

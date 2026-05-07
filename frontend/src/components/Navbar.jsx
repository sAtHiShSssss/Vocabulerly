import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, LayoutDashboard, Search, Brain, BarChart3, Languages } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export default function Navbar() {
  const { nativeLang, langName, enabled, setEnabled, languages, changeLanguage } = useTranslation();
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <BookOpen size={28} />
          <span>Vocabulerly</span>
        </div>
        <div className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/learn" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <BookOpen size={18} />
            <span>Learn</span>
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <Search size={18} />
            <span>Browse</span>
          </NavLink>
          <NavLink to="/quiz" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <Brain size={18} />
            <span>Quiz</span>
          </NavLink>
          <NavLink to="/progress" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <BarChart3 size={18} />
            <span>Progress</span>
          </NavLink>
        </div>
        <div className="navbar-actions">
          <div className="lang-selector-wrapper">
            <button
              className={`lang-toggle-btn ${enabled ? 'active' : ''}`}
              onClick={() => setShowLangMenu(!showLangMenu)}
              title={enabled ? `Translations: ${langName}` : 'Translations off'}
            >
              <Languages size={18} />
              <span className="lang-current">{enabled ? (nativeLang || 'ta').toUpperCase() : 'OFF'}</span>
            </button>
            {showLangMenu && (
              <div className="lang-dropdown" onMouseLeave={() => setShowLangMenu(false)}>
                <div className="lang-dropdown-header">
                  <span>Native Language</span>
                  <label className="lang-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                    />
                    <span className="lang-toggle-slider" />
                  </label>
                </div>
                {enabled && (
                  <div className="lang-options">
                    {Object.entries(languages).map(([code, name]) => (
                      <button
                        key={code}
                        className={`lang-option ${nativeLang === code ? 'selected' : ''}`}
                        onClick={() => { changeLanguage(code); setShowLangMenu(false); }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom navigation */}
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'bottom-nav-link active' : 'bottom-nav-link'}>
          <LayoutDashboard size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/learn" className={({ isActive }) => isActive ? 'bottom-nav-link active' : 'bottom-nav-link'}>
          <BookOpen size={20} />
          <span>Learn</span>
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => isActive ? 'bottom-nav-link active' : 'bottom-nav-link'}>
          <Search size={20} />
          <span>Browse</span>
        </NavLink>
        <NavLink to="/quiz" className={({ isActive }) => isActive ? 'bottom-nav-link active' : 'bottom-nav-link'}>
          <Brain size={20} />
          <span>Quiz</span>
        </NavLink>
        <NavLink to="/progress" className={({ isActive }) => isActive ? 'bottom-nav-link active' : 'bottom-nav-link'}>
          <BarChart3 size={20} />
          <span>Stats</span>
        </NavLink>
      </nav>
    </>
  );
}

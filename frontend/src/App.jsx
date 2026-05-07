import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Navbar from './components/Navbar';
import Notification from './components/Notification';
import Dashboard from './components/Dashboard';
import LearnMode from './components/LearnMode';
import SearchFilter from './components/SearchFilter';
import QuizMode from './components/QuizMode';
import ProgressStats from './components/ProgressStats';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="app">
          <Navbar />
          <Notification />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/learn" element={<LearnMode />} />
              <Route path="/search" element={<SearchFilter />} />
              <Route path="/quiz" element={<QuizMode />} />
              <Route path="/progress" element={<ProgressStats />} />
            </Routes>
          </main>
        </div>
      </AppProvider>
    </BrowserRouter>
  );
}

export default App

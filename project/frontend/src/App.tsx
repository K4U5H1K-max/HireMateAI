import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import InterviewScreen from './pages/InterviewScreen';
import VideoInterviewScreen from './pages/VideoInterviewScreen';
import ResultsPage from './pages/ResultsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
          <Route path="/interview" element={<InterviewScreen />} />
          <Route path="/video-interview" element={<VideoInterviewScreen />} />
          <Route path="/results" element={<ResultsPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

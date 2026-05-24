import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import AppShell from './components/layout/AppShell';
import HomePage from './pages/HomePage';
import CandidateLoginPage from './pages/CandidateLoginPage';
import EmployerLoginPage from './pages/EmployerLoginPage';
import CandidateSignupPage from './pages/CandidateSignupPage';
import EmployerSignupPage from './pages/EmployerSignupPage';
import EmployerProfilePage from './pages/EmployerProfilePage';
import EmployerJobsPage from './pages/EmployerJobsPage';
import EmployerJobDetailsPage from './pages/EmployerJobDetailsPage';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import InterviewScreen from './pages/InterviewScreen';
import VideoInterviewScreen from './pages/VideoInterviewScreen';
import ResultsPage from './pages/ResultsPage';
import StudentDashboard from './pages/StudentDashboard';
import InterviewDetailsPage from './pages/InterviewDetailsPage';
import CandidateJobsPage from './pages/CandidateJobsPage';
import JobApplicationPage from './pages/JobApplicationPage';
import CandidateApplicationStatusPage from './pages/CandidateApplicationStatusPage';

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/candidate-login" element={<CandidateLoginPage />} />
            <Route path="/candidate-signup" element={<CandidateSignupPage />} />
            <Route path="/employer-login" element={<EmployerLoginPage />} />
            <Route path="/employer-signup" element={<EmployerSignupPage />} />
            <Route path="/employer/profile" element={<EmployerProfilePage />} />
            <Route path="/employer/jobs" element={<EmployerJobsPage />} />
            <Route path="/employer/jobs/:jobId" element={<EmployerJobDetailsPage />} />
            <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
            <Route path="/interview" element={<InterviewScreen />} />
            <Route path="/video-interview" element={<VideoInterviewScreen />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/student-dashboard" element={<StudentDashboard />} />
            <Route path="/interview-details/:interviewId" element={<InterviewDetailsPage />} />
            <Route path="/candidate-jobs" element={<CandidateJobsPage />} />
            <Route path="/job-application" element={<JobApplicationPage />} />
            <Route path="/application-status" element={<CandidateApplicationStatusPage />} />
          </Route>
        </Routes>
      </Router>
    </LanguageProvider>
  );
}

export default App;

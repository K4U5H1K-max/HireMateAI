import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, FileText, Video, Calendar, TrendingUp } from 'lucide-react';
import {
  getCandidateInterviewHistory,
  calculateInterviewStats,
  onCandidateUserChanged,
  signOutCandidate,
  type CandidateInterview,
  type InterviewStats,
} from '../utils/candidateStore';
import ElectricBackground from '../components/ElectricBackground';
import PageContainer from '../components/layout/PageContainer';
import { Button, Card, Badge } from '../components/ui';
import ScoreRadarChart from '../components/results/ScoreRadarChart';
import AnimatedScoreCard from '../components/results/AnimatedScoreCard';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [displayName, setDisplayName] = useState('');
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [stats, setStats] = useState<InterviewStats>({
    totalInterviews: 0,
    avgTechnical: null,
    avgCommunication: null,
    avgRoleFit: null,
    avgPresence: null,
    avgFinal: null,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onCandidateUserChanged(async (user) => {
      if (!user) {
        navigate('/candidate-login');
        return;
      }

      setUserId(user.uid);
      setDisplayName(user.displayName || user.email || 'Candidate');

      try {
        const history = await getCandidateInterviewHistory(user.uid);
        setInterviews(history);
        const calculatedStats = calculateInterviewStats(history);
        setStats(calculatedStats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load interview history');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await signOutCandidate();
      navigate('/candidate-login');
    } catch (err) {
      setError('Could not sign out. Please try again.');
    }
  };

  const handleViewInterview = (interview: CandidateInterview) => {
    navigate(`/interview-details/${interview.id}`, { state: { interview } });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const radarData = {
    technical: stats.avgTechnical ?? 0,
    communication: stats.avgCommunication ?? 0,
    roleFit: stats.avgRoleFit ?? 0,
    presence: stats.avgPresence ?? 0,
    final: stats.avgFinal ?? 0,
  };

  if (loading) {
    return (
      <div className="relative flex-1 min-h-screen flex items-center justify-center">
        <ElectricBackground className="z-0 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-raised/70 to-surface pointer-events-none z-[1]" />
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4" />
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      <ElectricBackground className="z-0 opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-surface-raised/70 to-surface pointer-events-none z-[1]" />

      <PageContainer className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <Badge className="mb-4">Dashboard</Badge>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
              Welcome back, <span className="text-brand">{displayName.split(' ')[0]}</span>
            </h1>
            <p className="text-gray-400 text-lg mt-2">
              View your interview performance and progress over time
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          <Card variant="ghost" padding="md" className="text-center">
            <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Total Interviews</p>
            <p className="text-3xl font-bold text-brand">{stats.totalInterviews}</p>
          </Card>

          {stats.avgTechnical !== null && (
            <div>
              <AnimatedScoreCard
                label="Avg Technical"
                score={stats.avgTechnical}
                maxScore={10}
                animated={true}
              />
            </div>
          )}

          {stats.avgCommunication !== null && (
            <div>
              <AnimatedScoreCard
                label="Avg Communication"
                score={stats.avgCommunication}
                maxScore={10}
                animated={true}
              />
            </div>
          )}

          {stats.avgPresence !== null && (
            <div>
              <AnimatedScoreCard
                label="Avg Presence"
                score={stats.avgPresence}
                maxScore={10}
                animated={true}
              />
            </div>
          )}

          {stats.avgFinal !== null && (
            <div>
              <AnimatedScoreCard
                label="Avg Final Score"
                score={stats.avgFinal}
                maxScore={10}
                animated={true}
              />
            </div>
          )}
        </div>

        {/* Score Chart */}
        {stats.totalInterviews > 0 && (
          <Card variant="elevated" padding="lg" className="mb-10">
            <h2 className="text-xl font-bold text-white mb-6">Performance Overview</h2>
            <div className="flex justify-center">
              <div style={{ width: '100%', maxWidth: '500px', height: '400px' }}>
                <ScoreRadarChart data={radarData} />
              </div>
            </div>
          </Card>
        )}

        {/* Interview History */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-white mb-6">Interview History</h2>

          {interviews.length === 0 ? (
            <Card variant="ghost" padding="lg" className="text-center">
              <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No interviews yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Start with a mock interview to see your results here
              </p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => navigate('/resume-analyzer')}
              >
                Start Interview
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {interviews.map((interview) => (
                <Card
                  key={interview.id}
                  variant="ghost"
                  padding="md"
                  className="cursor-pointer hover:bg-brand-muted/20 transition-colors"
                  onClick={() => handleViewInterview(interview)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {interview.interviewType === 'video' ? (
                          <Video className="w-5 h-5 text-brand" />
                        ) : (
                          <FileText className="w-5 h-5 text-brand" />
                        )}
                        <h3 className="text-lg font-semibold text-white">
                          {interview.role || 'Unknown Role'}
                        </h3>
                        <Badge variant="secondary">
                          {interview.interviewType === 'video' ? 'Video' : 'Text'}
                        </Badge>
                      </div>
                      <p className="text-gray-400 text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDate(interview.createdAt)}
                      </p>
                      {interview.resumeSummary && (
                        <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                          {interview.resumeSummary}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3 text-right">
                      {interview.scores.final !== null && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Final Score</p>
                          <p className="text-2xl font-bold text-brand">
                            {interview.scores.final.toFixed(1)}
                          </p>
                          <p className="text-xs text-gray-500">/10</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {interview.scores.technical !== null && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Tech</p>
                            <p className="text-sm font-semibold text-gray-200">
                              {interview.scores.technical.toFixed(1)}
                            </p>
                          </div>
                        )}
                        {interview.scores.communication !== null && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Comm</p>
                            <p className="text-sm font-semibold text-gray-200">
                              {interview.scores.communication.toFixed(1)}
                            </p>
                          </div>
                        )}
                        {interview.scores.presence !== null && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Pres</p>
                            <p className="text-sm font-semibold text-gray-200">
                              {interview.scores.presence.toFixed(1)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <Card variant="elevated" padding="lg" className="text-center mb-10">
          <h3 className="text-xl font-bold text-white mb-2">Ready to practice more?</h3>
          <p className="text-gray-400 mb-6">
            Each interview helps improve your performance. Start a new mock interview or apply to real job opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button fullWidth size="lg" onClick={() => navigate('/resume-analyzer')}>
              Start New Interview
            </Button>
            <Button fullWidth variant="secondary" size="lg" onClick={() => navigate('/candidate-jobs')}>
              Browse Jobs
            </Button>
            <Button fullWidth variant="secondary" size="lg" onClick={() => navigate('/application-status')}>
              My Applications
            </Button>
          </div>
        </Card>
      </PageContainer>
    </div>
  );
};

export default StudentDashboard;

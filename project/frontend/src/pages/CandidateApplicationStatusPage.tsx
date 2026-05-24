import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Calendar, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';
import { getCandidateApplications } from '../utils/candidateStore';
import type { CandidateApplication } from '../utils/candidateStore';
import ElectricBackground from '../components/ElectricBackground';
import PageContainer from '../components/layout/PageContainer';
import { Button, Card, Badge } from '../components/ui';

const CandidateApplicationStatusPage = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadApplications = async () => {
      try {
        const apps = await getCandidateApplications();
        setApplications(apps);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load applications');
      } finally {
        setLoading(false);
      }
    };

    loadApplications();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'accepted':
        return <Badge>Interview Passed</Badge>;
      case 'rejected':
        return <Badge variant="secondary">Not Selected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="relative flex-1 min-h-screen flex items-center justify-center">
        <ElectricBackground className="z-0 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-surface-raised/70 to-surface pointer-events-none z-[1]" />
        <div className="relative z-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4" />
          <p className="text-gray-400">Loading applications...</p>
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
        <div className="mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2">
            Application <span className="text-brand">Status</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Track your job applications and interview outcomes
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {applications.length === 0 ? (
          <Card variant="ghost" padding="lg" className="text-center">
            <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No applications yet</p>
            <p className="text-gray-500 text-sm mb-6">Start applying to job openings to see them here</p>
            <Button onClick={() => navigate('/candidate-jobs')}>Browse Jobs</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {applications.map((app) => (
              <Card
                key={app.id}
                variant="ghost"
                padding="md"
                className="hover:bg-brand-muted/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-1">{app.positionTitle}</h3>
                    <p className="text-brand font-medium flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4" />
                      {app.companyName}
                    </p>

                    <div className="flex flex-wrap gap-3 text-sm text-gray-400 mb-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Applied: {formatDate(app.submittedAt)}
                      </span>
                      {app.interviewDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Interview: {formatDate(app.interviewDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusIcon(app.status)}
                    {getStatusBadge(app.status)}
                  </div>
                </div>

                {app.interviewScore && (
                  <div className="mb-4 p-3 bg-brand-muted/20 rounded-lg">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Interview Score
                    </p>
                    <p className="text-2xl font-bold text-brand">{app.interviewScore.toFixed(1)}/10</p>
                  </div>
                )}

                {app.feedback && (
                  <div className="mb-4 p-3 bg-brand-muted/10 rounded-lg border border-brand-border/50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Feedback
                    </p>
                    <p className="text-sm text-gray-300 line-clamp-2">{app.feedback}</p>
                  </div>
                )}

                {app.status === 'accepted' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/application-details/${app.id}`)}
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    View Details & Next Steps
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate('/student-dashboard')}
          >
            ← Back to Dashboard
          </Button>
          <Button
            onClick={() => navigate('/candidate-jobs')}
          >
            Browse More Jobs
          </Button>
        </div>
      </PageContainer>
    </div>
  );
};

export default CandidateApplicationStatusPage;

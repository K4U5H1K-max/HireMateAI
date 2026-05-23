import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Clock3, UsersRound } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import { Badge, Button, Card } from '../components/ui';
import type { JobApplication, JobPosting } from '../types/employer';
import {
  closeEmployerJob,
  getApplicationsForJob,
  getEmployerJobById,
  onEmployerUserChanged,
  openEmployerJob,
} from '../utils/employerStore';

const getApplicationRankScore = (application: JobApplication): number => {
  const values = [
    application.resumeScore,
    application.technicalScore,
    application.communicationScore,
    application.nonverbalScore,
    application.roleFitScore,
    application.finalScore,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (!values.length) return 0;

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

const EmployerJobDetailsPage = () => {
  const navigate = useNavigate();
  const { jobId = '' } = useParams();

  const [job, setJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = onEmployerUserChanged(async (user) => {
      if (!user) {
        navigate('/employer-login');
        return;
      }

      if (!jobId) {
        setError('Invalid job id.');
        setLoading(false);
        return;
      }

      try {
        const currentJob = await getEmployerJobById(user.uid, jobId);
        if (!currentJob) {
          setError('Job not found.');
          setLoading(false);
          return;
        }

        const apps = await getApplicationsForJob(user.uid, jobId);
        setJob(currentJob);
        setApplications(apps);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load job details.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [jobId, navigate]);

  const stats = useMemo(() => {
    const applicantsCount = applications.length;
    const qualifiedCount = applications.filter((app) => app.qualifiedForHumanInterview).length;
    const scoreSum = applications.reduce((acc, app) => acc + app.finalScore, 0);
    const averageScore = applicantsCount ? Number((scoreSum / applicantsCount).toFixed(2)) : 0;

    return {
      applicantsCount,
      qualifiedCount,
      averageScore,
    };
  }, [applications]);

  const toggleJobStatus = async () => {
    if (!job) return;

    setUpdating(true);
    setError('');

    try {
      if (job.status === 'open') {
        await closeEmployerJob(job.employerId, job.id);
      } else {
        await openEmployerJob(job.employerId, job.id);
      }

      setJob((current) =>
        current
          ? {
              ...current,
              status: current.status === 'open' ? 'closed' : 'open',
              closedAt: current.status === 'open' ? Date.now() : undefined,
            }
          : current
      );
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update job status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <p className="text-gray-300">Loading job analytics...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <PageContainer narrow>
        <Card variant="elevated" padding="lg" className="text-center">
          <p className="text-red-300 mb-4">{error || 'Job could not be loaded.'}</p>
          <Link to="/employer/jobs" className="text-brand hover:text-brand-dim transition-colors">
            Back to jobs dashboard
          </Link>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <Badge className="mb-3">Job Analytics</Badge>
          <h1 className="text-3xl font-bold text-white">{job.positionTitle}</h1>
          <p className="text-gray-400 mt-1">
            {job.companyName} · {job.workMode} · {job.location}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={toggleJobStatus} loading={updating}>
            {job.status === 'open' ? 'Close job' : 'Reopen job'}
          </Button>
          <Link
            to="/employer/jobs"
            className="inline-flex items-center gap-2 text-brand hover:text-brand-dim transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to jobs
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card variant="default" padding="md">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Applicants</p>
          <p className="text-3xl font-bold text-white mt-2 inline-flex items-center gap-2">
            <UsersRound className="w-6 h-6 text-brand" />
            {stats.applicantsCount}
          </p>
        </Card>

        <Card variant="default" padding="md">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Avg Final Score</p>
          <p className="text-3xl font-bold text-white mt-2 inline-flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand" />
            {stats.averageScore.toFixed(2)}
          </p>
        </Card>

        <Card variant="default" padding="md">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Job Status</p>
          <p className="text-3xl font-bold text-white mt-2 inline-flex items-center gap-2">
            <Clock3 className="w-6 h-6 text-brand" />
            {job.status === 'open' ? 'Open' : 'Closed'}
          </p>
        </Card>
      </div>

      <Card variant="elevated" padding="lg" className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-3">Job description</h2>
        <p className="text-gray-300 whitespace-pre-line">{job.jobDescription}</p>
        <h3 className="text-lg font-semibold text-white mt-5 mb-2">Requirements</h3>
        <p className="text-gray-300 whitespace-pre-line">{job.requirements}</p>
        <p className="text-sm text-gray-400 mt-4">
          Minimum score for human interview: {job.minScoreForHumanInterview.toFixed(1)} / 10
        </p>
      </Card>

      <Card variant="default" padding="lg">
        <h2 className="text-xl font-semibold text-white mb-4">Applicant outcomes</h2>

        {applications.length === 0 ? (
          <p className="text-gray-400">
            No applicants yet. Candidate submissions linked to this job will appear here with ranked score analytics.
          </p>
        ) : (
          <div className="grid gap-4">
            {applications.map((application, index) => {
              const rankScore = getApplicationRankScore(application);

              return (
                <details
                  key={application.id}
                  className="rounded-2xl border border-white/10 bg-surface-overlay/80 overflow-hidden"
                >
                  <summary className="list-none cursor-pointer px-4 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Rank #{index + 1}</p>
                      <h3 className="text-lg font-semibold text-white mt-1">{application.candidateName}</h3>
                      <p className="text-sm text-gray-400">{application.candidateEmail}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="rounded-full border border-brand-border/40 px-3 py-1 text-gray-200">
                        Combined score: {rankScore.toFixed(2)}
                      </span>
                      <span className="rounded-full border border-brand-border/40 px-3 py-1 text-gray-200">
                        Final: {application.finalScore.toFixed(1)}
                      </span>
                      <span
                        className={
                          application.qualifiedForHumanInterview
                            ? 'rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300'
                            : 'rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-300'
                        }
                      >
                        {application.qualifiedForHumanInterview ? 'Qualified' : 'Review'}
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-white/10 px-4 py-5 grid gap-5">
                    <div className="grid lg:grid-cols-2 gap-4">
                      <Card variant="default" padding="md">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">Resume</p>
                        <p className="text-sm text-gray-200 whitespace-pre-line">
                          {application.resumeSummary || 'No resume summary available.'}
                        </p>
                      </Card>

                      <Card variant="default" padding="md">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">Scores</p>
                        <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-200">
                          <p>Resume: {application.resumeScore?.toFixed(1) ?? '—'}</p>
                          <p>Technical: {application.technicalScore?.toFixed(1) ?? '—'}</p>
                          <p>Communication: {application.communicationScore?.toFixed(1) ?? '—'}</p>
                          <p>Non-verbal: {application.nonverbalScore?.toFixed(1) ?? '—'}</p>
                          <p>Role fit: {application.roleFitScore?.toFixed(1) ?? '—'}</p>
                          <p>Final: {application.finalScore.toFixed(1)}</p>
                        </div>
                      </Card>
                    </div>

                    <Card variant="default" padding="md">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-3">Interview answers</p>
                      {application.qaList?.length ? (
                        <div className="space-y-3">
                          {application.qaList.map((qa, qaIndex) => (
                            <div
                              key={`${application.id}-qa-${qaIndex}`}
                              className="rounded-xl border border-white/10 bg-surface-overlay p-4"
                            >
                              <p className="text-brand font-medium text-sm">Q{qaIndex + 1}: {qa.question}</p>
                              <p className="text-gray-200 text-sm mt-2 whitespace-pre-line">{qa.answer}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No saved answers available for this applicant.</p>
                      )}
                    </Card>

                    <div className="grid lg:grid-cols-2 gap-4">
                      <Card variant="default" padding="md">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">LLM feedback</p>
                        <p className="text-sm text-gray-200 whitespace-pre-line">
                          {application.feedback || application.rawEvaluation || 'No LLM feedback available.'}
                        </p>
                      </Card>

                      <Card variant="default" padding="md">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">Non-verbal feedback</p>
                        <p className="text-sm text-gray-200 whitespace-pre-line">
                          {application.nonverbalFeedback || 'No non-verbal feedback available.'}
                        </p>
                      </Card>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Card>
    </PageContainer>
  );
};

export default EmployerJobDetailsPage;

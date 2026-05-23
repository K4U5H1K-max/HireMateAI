import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Clock3, Plus, Sparkles } from 'lucide-react';
import PageContainer from '../components/layout/PageContainer';
import ElectricBackground from '../components/ElectricBackground';
import { Badge, Button, Card } from '../components/ui';
import type { EmployerProfile, JobPostingWithStats, WorkMode } from '../types/employer';
import {
  createEmployerJob,
  closeEmployerJob,
  getEmployerJobsWithStats,
  getEmployerProfile,
  onEmployerUserChanged,
  openEmployerJob,
} from '../utils/employerStore';

interface JobFormState {
  companyName?: string;
  positionTitle: string;
  jobDescription: string;
  workMode: WorkMode;
  location: string;
  requirements: string;
  minScoreForHumanInterview: number;
}

const INITIAL_JOB_FORM: JobFormState = {
  companyName: '',
  positionTitle: '',
  jobDescription: '',
  workMode: 'remote',
  location: '',
  requirements: '',
  minScoreForHumanInterview: 7,
};

const workModeOptions: Array<{ label: string; value: WorkMode }> = [
  { label: 'Remote', value: 'remote' },
  { label: 'On-site', value: 'on-site' },
  { label: 'Hybrid', value: 'hybrid' },
];

const EmployerJobsPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [jobs, setJobs] = useState<JobPostingWithStats[]>([]);
  const [jobForm, setJobForm] = useState<JobFormState>(INITIAL_JOB_FORM);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyJobId, setBusyJobId] = useState('');
  const [profileCheckDone, setProfileCheckDone] = useState(false);
  const [isFirstTimeNoProfile, setIsFirstTimeNoProfile] = useState(false);

  const reloadJobs = async (uid: string) => {
    const data = await getEmployerJobsWithStats(uid);
    setJobs(data);
  };

  useEffect(() => {
    const unsubscribe = onEmployerUserChanged(async (user) => {
      if (!user) {
        navigate('/employer-login');
        return;
      }

      setUserId(user.uid);
      setError('');

      try {
        const employerProfile = await getEmployerProfile(user.uid);

        if (!employerProfile) {
          // first time checking and no profile: show setup UI
          if (!profileCheckDone) {
            setIsFirstTimeNoProfile(true);
            setProfileCheckDone(true);
            setLoading(false);
            return;
          }

          // already checked once and still no profile: render dashboard without profile
          setProfile(null);
          setProfileCheckDone(true);
          await reloadJobs(user.uid);
          setLoading(false);
          return;
        }

        // profile found: render dashboard
        setProfile(employerProfile);
        setProfileCheckDone(true);
        setIsFirstTimeNoProfile(false);
        await reloadJobs(user.uid);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load jobs.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate, profileCheckDone]);

  const setField = (field: keyof JobFormState, value: string | number) => {
    setJobForm((prev) => ({ ...prev, [field]: value }));
  };

  // allow editing companyName in the form when profile is not present

  const qualifiedRate = useMemo(() => {
    const applicants = jobs.reduce((acc, job) => acc + job.applicantsCount, 0);
    const qualified = jobs.reduce((acc, job) => acc + job.qualifiedCount, 0);
    if (!applicants) return 0;
    return Math.round((qualified / applicants) * 100);
  }, [jobs]);

  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'open'), [jobs]);
  const closedJobs = useMemo(() => jobs.filter((job) => job.status === 'closed'), [jobs]);

  const handleCreateJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      setError('You must be signed in.');
      return;
    }

    const companyName = profile?.companyName ?? String(jobForm.companyName ?? '').trim();
    if (!companyName) {
      setError('Enter a company name or complete your employer profile.');
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      await createEmployerJob(userId, {
        companyName,
        positionTitle: jobForm.positionTitle,
        jobDescription: jobForm.jobDescription,
        workMode: jobForm.workMode,
        location: jobForm.location,
        requirements: jobForm.requirements,
        minScoreForHumanInterview: Number(jobForm.minScoreForHumanInterview),
      });

      setJobForm(INITIAL_JOB_FORM);
      setSuccess('Job listed successfully.');
      await reloadJobs(userId);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create job.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleJobStatus = async (jobId: string, nextStatus: 'open' | 'closed') => {
    if (!userId) return;

    setBusyJobId(jobId);
    setError('');
    setSuccess('');

    try {
      if (nextStatus === 'closed') {
        await closeEmployerJob(userId, jobId);
      } else {
        await openEmployerJob(userId, jobId);
      }

      await reloadJobs(userId);
      setSuccess(nextStatus === 'closed' ? 'Job closed successfully.' : 'Job reopened successfully.');
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update job status.');
    } finally {
      setBusyJobId('');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <p className="text-gray-300">Loading jobs dashboard...</p>
      </div>
    );
  }

  if (isFirstTimeNoProfile) {
    return (
      <PageContainer narrow>
        <Card variant="elevated" padding="lg" className="text-center">
          <Badge className="mb-4">Action Required</Badge>
          <h1 className="text-2xl font-bold text-white mb-2">Complete your profile first</h1>
          <p className="text-gray-400 mb-6">
            Job listing is locked until your employer profile is available.
          </p>
          <Button onClick={() => navigate('/employer/profile')}>Go to profile setup</Button>
        </Card>
      </PageContainer>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <ElectricBackground className="z-0 opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(5,252,211,0.12),transparent_42%)] pointer-events-none z-[1]" />
      <PageContainer className="relative z-10 max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <Badge className="mb-3">Employer Workspace</Badge>
            <h1 className="text-3xl font-bold text-white">Post jobs and track pipeline</h1>
            <p className="text-gray-400 mt-1">Company: {profile?.companyName ?? 'Your company'}</p>
          </div>
          <Link to="/employer/profile" className="text-sm text-brand hover:text-brand-dim transition-colors">
            Edit profile
          </Link>
        </div>

        <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <Card variant="elevated" padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand mb-2">List a new role</p>
                <h2 className="text-xl text-white">Create job opportunity</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => document.getElementById('job-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                View jobs
              </Button>
            </div>
            <form onSubmit={handleCreateJob} className="grid gap-4">
              <label className="text-sm text-gray-300">
                Company
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl opacity-80"
                  value={profile?.companyName ?? jobForm.companyName}
                  disabled={Boolean(profile)}
                  onChange={(event) => setField('companyName', event.target.value)}
                  placeholder="Company name"
                  required={!profile}
                />
              </label>

              <label className="text-sm text-gray-300">
                Position title *
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                  value={jobForm.positionTitle}
                  onChange={(event) => setField('positionTitle', event.target.value)}
                  placeholder="Senior Frontend Engineer"
                  required
                />
              </label>

              <label className="text-sm text-gray-300">
                Job description *
                <textarea
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl min-h-24"
                  value={jobForm.jobDescription}
                  onChange={(event) => setField('jobDescription', event.target.value)}
                  placeholder="Describe scope, responsibilities, and goals."
                  required
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="text-sm text-gray-300">
                  Work location type *
                  <select
                    className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                    value={jobForm.workMode}
                    onChange={(event) => setField('workMode', event.target.value as WorkMode)}
                  >
                    {workModeOptions.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-gray-300">
                  Work location *
                  <input
                    className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                    value={jobForm.location}
                    onChange={(event) => setField('location', event.target.value)}
                    placeholder="Bengaluru, India"
                    required
                  />
                </label>
              </div>

              <label className="text-sm text-gray-300">
                Requirements *
                <textarea
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl min-h-24"
                  value={jobForm.requirements}
                  onChange={(event) => setField('requirements', event.target.value)}
                  placeholder="Core skills, tools, and experience expected."
                  required
                />
              </label>

              <label className="text-sm text-gray-300">
                Minimum interview score for human round (0-10)
                <input
                  className="mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl"
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={jobForm.minScoreForHumanInterview}
                  onChange={(event) => setField('minScoreForHumanInterview', Number(event.target.value))}
                />
              </label>

              {error && (
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                  {success}
                </p>
              )}

              <Button type="submit" loading={creating}>
                <Plus className="w-4 h-4" />
                List Job
              </Button>
            </form>
          </Card>

          <div className="grid gap-5 content-start">
            <Card variant="default" padding="md">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Pipeline Overview</p>
              <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                <div className="rounded-xl border border-brand-border/40 p-3 bg-surface-overlay">
                  <p className="text-2xl font-bold text-white">{openJobs.length}</p>
                  <p className="text-xs text-gray-400">Open Jobs</p>
                </div>
                <div className="rounded-xl border border-brand-border/40 p-3 bg-surface-overlay">
                  <p className="text-2xl font-bold text-white">
                    {jobs.reduce((acc, job) => acc + job.applicantsCount, 0)}
                  </p>
                  <p className="text-xs text-gray-400">Applicants</p>
                </div>
                <div className="rounded-xl border border-brand-border/40 p-3 bg-surface-overlay">
                  <p className="text-2xl font-bold text-white">{qualifiedRate}%</p>
                  <p className="text-xs text-gray-400">Qualified</p>
                </div>
              </div>
            </Card>

            <Card id="job-listings" variant="default" padding="md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold inline-flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-brand" />
                  Listed jobs
                </h3>
                <span className="text-xs text-gray-400">{jobs.length} total</span>
              </div>

              {jobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-brand-border/60 bg-surface-overlay/70 p-5 text-sm text-gray-300">
                  <p className="font-medium text-white">No jobs listed yet.</p>
                  <p className="mt-1 text-gray-400">
                    Create your first opportunity to start tracking applicants, scores, and closed roles.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-3 inline-flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand" />
                      Open jobs
                    </p>

                    {openJobs.length === 0 ? (
                      <p className="text-sm text-gray-400 rounded-xl border border-white/10 bg-surface-overlay/60 p-4">
                        No open jobs right now.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {openJobs.map((job) => (
                          <div
                            key={job.id}
                            className="rounded-xl border border-brand-border/40 bg-surface-overlay px-4 py-3 transition-colors hover:border-brand/70"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <Link to={`/employer/jobs/${job.id}`} className="min-w-0 flex-1">
                                <p className="text-white font-medium">{job.positionTitle}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {job.workMode} · {job.location}
                                </p>
                                <p className="text-xs text-gray-300 mt-2">
                                  Applicants: {job.applicantsCount} · Qualified: {job.qualifiedCount} · Avg score:{' '}
                                  {job.averageFinalScore.toFixed(2)}
                                </p>
                              </Link>

                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                                  Open
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={busyJobId === job.id}
                                  onClick={() => void handleToggleJobStatus(job.id, 'closed')}
                                >
                                  Close job
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-3 inline-flex items-center gap-2">
                      <Clock3 className="w-4 h-4 text-brand" />
                      Closed jobs
                    </p>

                    {closedJobs.length === 0 ? (
                      <p className="text-sm text-gray-400 rounded-xl border border-white/10 bg-surface-overlay/60 p-4">
                        No closed jobs yet.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {closedJobs.map((job) => (
                          <div
                            key={job.id}
                            className="rounded-xl border border-white/10 bg-surface-overlay px-4 py-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <Link to={`/employer/jobs/${job.id}`} className="min-w-0 flex-1 opacity-90">
                                <p className="text-white font-medium">{job.positionTitle}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {job.workMode} · {job.location}
                                </p>
                                <p className="text-xs text-gray-300 mt-2">
                                  Applicants: {job.applicantsCount} · Qualified: {job.qualifiedCount} · Avg score:{' '}
                                  {job.averageFinalScore.toFixed(2)}
                                </p>
                              </Link>

                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-gray-500/10 text-gray-300 border-gray-500/30">
                                  Closed
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  loading={busyJobId === job.id}
                                  onClick={() => void handleToggleJobStatus(job.id, 'open')}
                                >
                                  Reopen
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <Card variant="ghost" padding="sm" className="text-xs text-gray-400 inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand" />
              Applicant analytics update automatically as applications are added for each job.
            </Card>
          </div>
        </div>
      </PageContainer>
    </div>
  );
};

export default EmployerJobsPage;

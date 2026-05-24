import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Upload, FileText, Video, ArrowRight, Loader2 } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import type { ResumeEvaluationResponse, JobPosting } from '../types';
import ElectricBackground from '../components/ElectricBackground';
import PageContainer from '../components/layout/PageContainer';
import { Button, Card, Badge } from '../components/ui';
import { cn } from '../lib/cn';

interface LocationState {
  job: JobPosting;
}

type ApplicationStep = 'resume' | 'interview-type' | 'interview' | 'submitted';

const JobApplicationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedLanguage } = useLanguage();
  const state = location.state as LocationState | null;

  const [step, setStep] = useState<ApplicationStep>('resume');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeResults, setResumeResults] = useState<ResumeEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoInterview, setVideoInterview] = useState(false);

  const job = state?.job;

  useEffect(() => {
    if (!job) {
      navigate('/candidate-jobs');
    }
  }, [job, navigate]);

  if (!job) {
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.txt')) {
      setError('Please upload a PDF or TXT file');
      return;
    }

    setResumeFile(file);
    setError('');
  };

  const handleAnalyzeResume = async () => {
    if (!resumeFile) {
      setError('Please upload a resume');
      return;
    }

    setLoading(true);
    const formPayload = new FormData();
    formPayload.append('file', resumeFile);
    formPayload.append('role', job.positionTitle);

    try {
      const response = await fetch(API_ENDPOINTS.uploadResume, {
        method: 'POST',
        body: formPayload,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          (data && (data.detail || data.message)) || `Server error (${response.status})`;
        throw new Error(typeof detail === 'string' ? detail : 'Failed to analyze resume');
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to analyze resume');
      }

      setResumeResults(data);
      setStep('interview-type');
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Cannot reach the backend. Start it with: python backendmp.py');
      } else {
        setError(err instanceof Error ? err.message : 'Error analyzing resume');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = () => {
    navigate(videoInterview ? '/video-interview' : '/interview', {
      state: {
        company: job.companyName,
        role: job.positionTitle,
        numQuestions: 5,
        resumeSummary: resumeResults?.resume_summary,
        language: selectedLanguage,
        jobId: job.id,
        isEmployerJob: true,
      },
    });
  };

  const inputClass =
    'mt-2 w-full bg-surface-overlay border border-brand-border text-white px-4 py-3 rounded-xl focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/50 transition-colors';

  return (
    <div className="relative flex-1 min-h-0">
      <ElectricBackground className="z-0 opacity-50" />
      <div className="absolute inset-0 bg-gradient-to-b from-surface-raised/70 to-surface pointer-events-none z-[1]" />

      <PageContainer narrow className="relative z-10">
        {/* Job Details */}
        <div className="mb-10">
          <Button
            variant="secondary"
            size="sm"
            className="mb-6"
            onClick={() => navigate('/candidate-jobs')}
          >
            ← Back to Jobs
          </Button>

          <h1 className="text-4xl font-extrabold text-white mb-2">
            Apply for <span className="text-brand">{job.positionTitle}</span>
          </h1>
          <p className="text-gray-400 text-lg mb-4">{job.companyName}</p>

          <div className="flex flex-wrap gap-2 mb-6">
            <Badge>{job.location}</Badge>
            <Badge variant="secondary">{job.workMode}</Badge>
            {job.minScoreForHumanInterview && (
              <Badge variant="secondary">Min Score: {job.minScoreForHumanInterview}/10</Badge>
            )}
          </div>
        </div>

        {/* Step 1: Resume Upload */}
        {step === 'resume' && (
          <Card variant="elevated" padding="lg" className="mb-10">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">
                Step 1: <span className="text-brand">Upload Resume</span>
              </h2>
              <p className="text-gray-400 mt-2">
                Share your resume so we can evaluate your fit for this role
              </p>
            </div>

            <label className="text-white font-medium text-sm block mb-3">Resume</label>
            <div className="mt-3 mb-6">
              <input
                type="file"
                id="upload"
                className="hidden"
                accept=".pdf,.txt"
                onChange={handleFileChange}
              />
              <label
                htmlFor="upload"
                className="flex flex-col items-center justify-center border-dashed border-2 border-brand-border bg-surface-overlay p-10 rounded-xl cursor-pointer hover:border-brand hover:bg-brand-muted/30 transition-colors"
              >
                {resumeFile ? (
                  <>
                    <FileText className="text-brand w-10 h-10" />
                    <p className="text-white mt-2 text-sm">{resumeFile.name}</p>
                  </>
                ) : (
                  <>
                    <Upload className="text-brand w-10 h-10" />
                    <p className="text-white mt-2 text-sm">Click to upload resume (PDF/TXT)</p>
                  </>
                )}
              </label>
            </div>

            {error && (
              <p className="mt-4 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <Button
              fullWidth
              size="lg"
              className="mt-8"
              loading={loading}
              onClick={handleAnalyzeResume}
            >
              Analyze & Continue
            </Button>
          </Card>
        )}

        {/* Resume Results & Interview Type Selection */}
        {step === 'interview-type' && resumeResults && (
          <>
            <Card variant="elevated" padding="lg" className="mb-10">
              <h2 className="text-xl font-bold text-white mb-6">Resume Analysis</h2>

              <Card variant="ghost" padding="md" className="mb-6">
                <h3 className="text-brand text-lg font-semibold mb-2">Summary</h3>
                <p className="text-gray-200 text-sm">{resumeResults.resume_summary}</p>
              </Card>

              {/* Display Scores if Available */}
              {(resumeResults.technical_score ||
                resumeResults.communication_score ||
                resumeResults.experience_score) && (
                <Card variant="ghost" padding="md" className="mb-6">
                  <h3 className="text-brand text-lg font-semibold mb-4">Scores</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {resumeResults.technical_score !== undefined && (
                      <div className="text-center p-3 bg-brand-muted/30 rounded-lg">
                        <p className="text-gray-400 text-xs uppercase">Technical</p>
                        <p className="text-xl font-bold text-brand mt-1">
                          {resumeResults.technical_score.toFixed(1)}
                        </p>
                      </div>
                    )}
                    {resumeResults.communication_score !== undefined && (
                      <div className="text-center p-3 bg-brand-muted/30 rounded-lg">
                        <p className="text-gray-400 text-xs uppercase">Communication</p>
                        <p className="text-xl font-bold text-brand mt-1">
                          {resumeResults.communication_score.toFixed(1)}
                        </p>
                      </div>
                    )}
                    {resumeResults.overall_score !== undefined && (
                      <div className="text-center p-3 bg-brand-muted/30 rounded-lg">
                        <p className="text-gray-400 text-xs uppercase">Overall</p>
                        <p className="text-xl font-bold text-brand mt-1">
                          {resumeResults.overall_score.toFixed(1)}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </Card>

            <Card variant="elevated" padding="lg" className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-6">
                Step 2: <span className="text-brand">Interview Setup</span>
              </h2>

              <div className="mb-8">
                <div className="mb-6">
                  <LanguageSelector label="Interview Language" showLabel={true} />
                </div>

                <h3 className="text-white font-semibold mb-4">Interview Type</h3>
                <div className="space-y-3">
                  <div
                    className={cn(
                      'p-4 rounded-xl border-2 cursor-pointer transition-all',
                      videoInterview
                        ? 'border-brand bg-brand-muted/30'
                        : 'border-brand-border bg-surface-overlay hover:border-brand'
                    )}
                    onClick={() => setVideoInterview(false)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText
                        className={cn(
                          'w-6 h-6',
                          !videoInterview ? 'text-brand' : 'text-gray-500'
                        )}
                      />
                      <div>
                        <p
                          className={cn(
                            'font-semibold',
                            !videoInterview ? 'text-white' : 'text-gray-400'
                          )}
                        >
                          Text Interview
                        </p>
                        <p className="text-sm text-gray-500">Answer questions via text</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      'p-4 rounded-xl border-2 cursor-pointer transition-all',
                      videoInterview
                        ? 'border-brand bg-brand-muted/30'
                        : 'border-brand-border bg-surface-overlay hover:border-brand'
                    )}
                    onClick={() => setVideoInterview(true)}
                  >
                    <div className="flex items-center gap-3">
                      <Video
                        className={cn(
                          'w-6 h-6',
                          videoInterview ? 'text-brand' : 'text-gray-500'
                        )}
                      />
                      <div>
                        <p
                          className={cn(
                            'font-semibold',
                            videoInterview ? 'text-white' : 'text-gray-400'
                          )}
                        >
                          Video Interview
                        </p>
                        <p className="text-sm text-gray-500">
                          Camera on with body language scoring
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                fullWidth
                size="lg"
                onClick={handleStartInterview}
                className="gap-2"
              >
                Start Interview
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Card>
          </>
        )}
      </PageContainer>
    </div>
  );
};

export default JobApplicationPage;

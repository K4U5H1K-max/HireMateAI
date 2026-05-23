import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Video } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import type { ResumeEvaluationResponse } from '../types';
import ElectricBackground from '../components/ElectricBackground';
import PageContainer from '../components/layout/PageContainer';
import { Button, Card, Badge } from '../components/ui';
import { cn } from '../lib/cn';

const ResumeAnalyzer = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    company: '',
    role: '',
    numQuestions: 5,
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resumeResults, setResumeResults] = useState<ResumeEvaluationResponse | null>(null);
  const [videoInterview, setVideoInterview] = useState(false);
  const [error, setError] = useState('');

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
    if (!resumeFile || !formData.role) {
      setError('Please upload a resume and enter job role');
      return;
    }

    setLoading(true);
    const formPayload = new FormData();
    formPayload.append('file', resumeFile);
    formPayload.append('role', formData.role);

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
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          'Cannot reach the backend at http://localhost:8000. Start it with: python backendmp.py'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Error analyzing resume');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInterview = () => {
    navigate(videoInterview ? '/video-interview' : '/interview', {
      state: {
        company: formData.company,
        role: formData.role,
        numQuestions: formData.numQuestions,
        resumeSummary: resumeResults?.resume_summary,
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
        <div className="text-center mb-10">
          <Badge className="mb-4">Step 1 — Resume</Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
            Resume <span className="text-brand">Analyzer</span>
          </h1>
          <p className="text-gray-400 text-lg mt-2">
            Upload your resume and let AI evaluate your profile
          </p>
        </div>

        <Card variant="elevated" padding="lg">
          <label className="text-white font-medium text-sm">Company Name</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Enter company name"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          />

          <label className="text-white font-medium text-sm mt-6 block">Job Role</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Enter job role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          />

          <label className="text-white font-medium text-sm mt-6 block">
            Number of Questions: <span className="text-brand">{formData.numQuestions}</span>
          </label>
          <input
            type="range"
            min={1}
            max={15}
            value={formData.numQuestions}
            onChange={(e) =>
              setFormData({ ...formData, numQuestions: parseInt(e.target.value, 10) })
            }
            className="w-full mt-2 accent-brand"
          />

          <label className="text-white font-medium text-sm mt-8 block">Resume Upload</label>
          <div className="mt-3">
            <input type="file" id="upload" className="hidden" accept=".pdf,.txt" onChange={handleFileChange} />
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
            Analyze Resume
          </Button>

          {resumeResults && (
            <div className="mt-10 space-y-6 animate-fade-in">
              <Card variant="ghost" padding="md">
                <h3 className="text-brand text-lg font-semibold">Resume Summary</h3>
                <p className="text-gray-200 mt-2 text-sm leading-relaxed">{resumeResults.resume_summary}</p>
              </Card>

              <Card variant="ghost" padding="md">
                <h3 className="text-brand text-lg font-semibold">Evaluation</h3>
                <p className="text-gray-200 mt-2 text-sm leading-relaxed whitespace-pre-line">
                  {resumeResults.evaluation}
                </p>
              </Card>

              <Card variant="ghost" padding="md">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Video className="w-6 h-6 text-brand mt-0.5 shrink-0" />
                    <div>
                      <p className="text-white font-semibold">Video Interview</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Camera on with body language and presence scoring.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={videoInterview}
                    aria-label="Enable video interview"
                    onClick={() => setVideoInterview((on) => !on)}
                    className={cn(
                      'relative w-14 h-8 rounded-full transition-colors shrink-0',
                      videoInterview ? 'bg-brand' : 'bg-gray-600'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform',
                        videoInterview ? 'translate-x-6' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              </Card>

              <Button fullWidth size="lg" onClick={handleGenerateInterview}>
                Generate Interview Questions
              </Button>
            </div>
          )}
        </Card>
      </PageContainer>
    </div>
  );
};

export default ResumeAnalyzer;

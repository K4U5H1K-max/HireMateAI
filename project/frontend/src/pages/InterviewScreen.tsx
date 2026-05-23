import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Volume2 } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import type { QuestionGenerationResponse, QAPair } from '../types';
import HybridAnswerInput from '../components/HybridAnswerInput';
import { useHybridAnswer } from '../hooks/useHybridAnswer';
import PageContainer from '../components/layout/PageContainer';
import InterviewQuestionProgress from '../components/layout/InterviewQuestionProgress';
import { Button, Card, Badge } from '../components/ui';

interface LocationState {
  company: string;
  role: string;
  numQuestions: number;
  resumeSummary: string;
}

const InterviewScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [qaList, setQaList] = useState<QAPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const answer = useHybridAnswer({ releaseStreamOnStop: true });

  useEffect(() => {
    if (!state) {
      navigate('/');
      return;
    }
    generateQuestions();
    return () => {
      answer.releaseStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    answer.resetAnswer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex]);

  const generateQuestions = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.generateQuestions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: state.company,
          role: state.role,
          resume_summary: state.resumeSummary,
          num_questions: state.numQuestions,
        }),
      });

      const data: QuestionGenerationResponse | null = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          (data as { detail?: string; message?: string } | null)?.detail ||
          (data as { message?: string } | null)?.message ||
          `Server error (${response.status})`;
        throw new Error(typeof detail === 'string' ? detail : 'Failed to generate questions');
      }

      if (!data?.questions?.length) {
        throw new Error('No interview questions were returned');
      }

      setQuestions(data.questions);
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          'Cannot reach the backend at http://localhost:8000. Start it with: python backendmp.py'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate questions');
      }
    } finally {
      setLoading(false);
    }
  };

  const playQuestionAudio = async (questionText: string) => {
    try {
      setIsPlayingAudio(true);
      const response = await fetch(API_ENDPOINTS.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: questionText, rate: 150 }),
      });

      if (!response.ok) throw new Error('Failed to generate audio');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) audioRef.current.pause();

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
    } catch {
      setIsPlayingAudio(false);
      setError('Audio playback failed');
    }
  };

  const handleSubmitAnswer = () => {
    if (answer.isMicActive) {
      answer.stopRecording();
    }

    const text = answer.getSubmitAnswer();
    if (!text) {
      setError('Answer cannot be empty');
      return;
    }

    const newQA: QAPair = {
      question: questions[currentQuestionIndex],
      answer: text,
    };

    const updatedQAList = [...qaList, newQA];
    setQaList(updatedQAList);
    answer.resetAnswer();
    setError('');

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      navigate('/results', {
        state: {
          qaList: updatedQAList,
          role: state.role,
          resumeSummary: state.resumeSummary,
        },
      });
    }
  };

  const displayError = error || answer.error;
  const canSubmit = Boolean(answer.finalAnswer.trim());

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="w-14 h-14 text-brand animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Generating interview questions…</p>
          <p className="text-gray-500 text-sm mt-2">Tailored to your resume and role</p>
        </div>
      </div>
    );
  }

  return (
    <PageContainer narrow>
      <div className="text-center mb-6">
        <Badge className="mb-3">Step 3 — Interview</Badge>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">AI Interview</h1>
        <p className="text-gray-400">Role: {state.role}</p>
      </div>

      <InterviewQuestionProgress
        current={currentQuestionIndex + 1}
        total={questions.length}
        className="mb-6"
      />

      <Card variant="elevated" padding="lg" className="mb-6">
        <div className="flex items-start gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl text-white flex-1 leading-relaxed">
            {questions[currentQuestionIndex]}
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => playQuestionAudio(questions[currentQuestionIndex])}
            disabled={isPlayingAudio}
            aria-label="Play question audio"
            className="shrink-0 px-3"
          >
            <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
          </Button>
        </div>

        <HybridAnswerInput
          value={answer.finalAnswer}
          onChange={answer.handleTextChange}
          onSelectCapture={answer.captureSelection}
          textareaRef={answer.textareaRef}
          recordingPhase={answer.recordingPhase}
          onStartRecording={answer.startRecording}
          onStopRecording={answer.stopRecording}
          onPauseRecording={answer.pauseRecording}
          onResumeRecording={answer.resumeRecording}
        />

        <Button fullWidth size="lg" className="mt-6" disabled={!canSubmit} onClick={handleSubmitAnswer}>
          {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Interview'}
        </Button>

        {displayError && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mt-4">
            <p className="text-red-400 text-sm">{displayError}</p>
          </div>
        )}
      </Card>

      <Card variant="ghost" padding="sm" className="text-center text-gray-400 text-sm">
        Questions answered: {qaList.length} / {questions.length}
      </Card>
    </PageContainer>
  );
};

export default InterviewScreen;

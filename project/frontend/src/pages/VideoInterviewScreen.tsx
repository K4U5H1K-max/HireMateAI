import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, Loader2, Volume2, ShieldCheck, AlertCircle } from 'lucide-react';
import { API_ENDPOINTS } from '../config/api';
import type { QuestionGenerationResponse, QAPair } from '../types';
import HybridAnswerInput from '../components/HybridAnswerInput';
import { useHybridAnswer } from '../hooks/useHybridAnswer';
import { GestureAnalyzer } from '../utils/gestureAnalysis';
import PageContainer from '../components/layout/PageContainer';
import InterviewQuestionProgress from '../components/layout/InterviewQuestionProgress';
import { Button, Card, Badge } from '../components/ui';

interface LocationState {
  company: string;
  role: string;
  numQuestions: number;
  resumeSummary: string;
}

type PermissionStatus = 'pending' | 'granted' | 'denied';

const VideoInterviewScreen = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoNodeRef = useRef<HTMLVideoElement | null>(null);
  const gestureAnalyzerRef = useRef<GestureAnalyzer | null>(null);
  const pendingMetricsRef = useRef<QAPair['nonverbal'] | null>(null);

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('pending');
  const [permissionError, setPermissionError] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [qaList, setQaList] = useState<QAPair[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [gestureReady, setGestureReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const getInterviewAudioStream = useCallback(async () => {
    if (!streamRef.current) {
      throw new Error('Camera and microphone are not ready.');
    }
    const audioTracks = streamRef.current.getAudioTracks();
    if (!audioTracks.length) {
      throw new Error('Microphone is not available.');
    }
    return new MediaStream(audioTracks);
  }, []);

  const answer = useHybridAnswer({
    releaseStreamOnStop: false,
    getAudioStream: getInterviewAudioStream,
    onRecordingStart: () => {
      if (gestureReady && gestureAnalyzerRef.current && videoNodeRef.current) {
        gestureAnalyzerRef.current.start(videoNodeRef.current);
      }
    },
    onRecordingStop: () => {
      if (gestureAnalyzerRef.current) {
        pendingMetricsRef.current = gestureAnalyzerRef.current.stop();
      }
    },
  });

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoNodeRef.current = node;
  }, []);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    setPreviewStream(null);
    if (videoNodeRef.current) {
      videoNodeRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    const video = videoNodeRef.current;
    const stream = previewStream;
    if (!video || !stream) return;

    setCameraReady(false);
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    const markReady = () => setCameraReady(true);
    video.addEventListener('loadeddata', markReady);
    video.addEventListener('playing', markReady);

    void video.play().catch(() => {
      window.setTimeout(() => void video.play().catch(() => {}), 400);
    });

    return () => {
      video.removeEventListener('loadeddata', markReady);
      video.removeEventListener('playing', markReady);
    };
  }, [previewStream, permissionStatus, loadingQuestions, questions.length]);

  const requestPermissions = useCallback(async () => {
    setPermissionError('');
    setCameraReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera and microphone are not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      const hasVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');
      const hasAudio = stream.getAudioTracks().some((t) => t.readyState === 'live');

      if (!hasVideo || !hasAudio) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('Both camera and microphone are required to start the interview.');
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      streamRef.current = stream;
      setPreviewStream(stream);
      setPermissionStatus('granted');
    } catch (err) {
      stopStream();
      setPermissionStatus('denied');
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionError(
            'Camera and microphone access was denied. Allow both in your browser settings, then try again.'
          );
        } else if (err.name === 'NotFoundError') {
          setPermissionError('No camera or microphone was found on this device.');
        } else {
          setPermissionError(err.message || 'Could not access camera or microphone.');
        }
      } else {
        setPermissionError(
          err instanceof Error ? err.message : 'Could not access camera or microphone.'
        );
      }
    }
  }, [stopStream]);

  const generateQuestions = useCallback(async () => {
    if (!state) return;

    setLoadingQuestions(true);
    setError('');

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
        setError('Cannot reach the backend. Start it with: python backendmp.py');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate questions');
      }
    } finally {
      setLoadingQuestions(false);
    }
  }, [state]);

  useEffect(() => {
    if (!state) {
      navigate('/');
      return;
    }

    let active = true;

    const initCamera = async () => {
      setPermissionError('');
      setCameraReady(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera and microphone are not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const hasVideo = stream.getVideoTracks().some((t) => t.readyState === 'live');
        const hasAudio = stream.getAudioTracks().some((t) => t.readyState === 'live');
        if (!hasVideo || !hasAudio) {
          stream.getTracks().forEach((t) => t.stop());
          throw new Error('Both camera and microphone are required to start the interview.');
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        streamRef.current = stream;
        setPreviewStream(stream);
        setPermissionStatus('granted');
      } catch (err) {
        if (!active) return;
        stopStream();
        setPermissionStatus('denied');
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setPermissionError(
              'Camera and microphone access was denied. Allow both in your browser settings, then try again.'
            );
          } else if (err.name === 'NotFoundError') {
            setPermissionError('No camera or microphone was found on this device.');
          } else {
            setPermissionError(err.message || 'Could not access camera or microphone.');
          }
        } else {
          setPermissionError(
            err instanceof Error ? err.message : 'Could not access camera or microphone.'
          );
        }
      }
    };

    initCamera();
    return () => {
      active = false;
    };
  }, [state, navigate, stopStream]);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  useEffect(() => {
    if (permissionStatus === 'granted' && questions.length === 0 && !loadingQuestions && !error) {
      generateQuestions();
    }
  }, [permissionStatus, questions.length, loadingQuestions, error, generateQuestions]);

  useEffect(() => {
    answer.resetAnswer();
    pendingMetricsRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex]);

  useEffect(() => {
    let cancelled = false;
    const analyzer = new GestureAnalyzer();
    gestureAnalyzerRef.current = analyzer;
    analyzer
      .init()
      .then(() => {
        if (!cancelled) setGestureReady(true);
      })
      .catch(() => {
        if (!cancelled) setGestureReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      setError('Question narration failed');
    }
  };

  const handleSubmitAnswer = () => {
    if (answer.isMicActive) {
      answer.stopRecording();
    }

    const text = answer.getSubmitAnswer();
    if (!text) {
      setError('Type or record your answer before continuing.');
      return;
    }

    const newQA: QAPair = {
      question: questions[currentQuestionIndex],
      answer: text,
      nonverbal: pendingMetricsRef.current ?? undefined,
    };

    const updatedQAList = [...qaList, newQA];
    setQaList(updatedQAList);
    answer.resetAnswer();
    pendingMetricsRef.current = null;
    setError('');

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((i) => i + 1);
    } else {
      stopStream();
      navigate('/results', {
        state: {
          qaList: updatedQAList,
          role: state!.role,
          resumeSummary: state!.resumeSummary,
          isVideoInterview: true,
        },
      });
    }
  };

  const displayError = error || answer.error;
  const canSubmit = Boolean(answer.finalAnswer.trim());

  const showInterview = permissionStatus === 'granted' && questions.length > 0 && !loadingQuestions;
  const showLoading = permissionStatus === 'granted' && (loadingQuestions || questions.length === 0);

  if (!state) return null;

  if (permissionStatus !== 'granted') {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <Card variant="elevated" padding="lg" className="max-w-lg w-full text-center">
          <ShieldCheck className="w-14 h-14 text-brand mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Permissions required</h1>
          <p className="text-gray-400 mb-6">
            The video interview needs access to your camera and microphone before it can begin.
          </p>
          {permissionStatus === 'denied' && permissionError && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/40 rounded-lg p-4 mb-6 text-left">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{permissionError}</p>
            </div>
          )}
          <Button fullWidth size="lg" onClick={requestPermissions}>
            Enable camera & microphone
          </Button>
          <button
            type="button"
            onClick={() => navigate('/resume-analyzer')}
            className="mt-4 text-gray-400 hover:text-brand text-sm transition-colors"
          >
            Back to resume analyzer
          </button>
        </Card>
      </div>
    );
  }

  return (
    <PageContainer>
        {showLoading && (
          <div className="text-center mb-6">
            <Loader2 className="w-10 h-10 text-brand animate-spin mx-auto mb-3" />
            <p className="text-white">{error || 'Generating interview questions…'}</p>
            {error && (
              <Button className="mt-4" onClick={generateQuestions}>
                Retry
              </Button>
            )}
          </div>
        )}

        {showInterview && (
          <div className="text-center mb-6">
            <Badge className="mb-3">Step 3 — Video Interview</Badge>
            <h1 className="text-3xl font-bold text-white">Video Interview</h1>
            <p className="text-gray-400 mt-1">Role: {state.role}</p>
            <InterviewQuestionProgress
              current={currentQuestionIndex + 1}
              total={questions.length}
              className="mt-6 max-w-md mx-auto"
            />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="relative bg-surface-raised rounded-2xl overflow-hidden border border-brand-border min-h-[280px] lg:min-h-[360px] shadow-card">
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover bg-gray-800 scale-x-[-1]"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 gap-3">
                <Loader2 className="w-10 h-10 text-brand animate-spin" />
                <p className="text-gray-400 text-sm">Starting camera...</p>
              </div>
            )}
            {cameraReady && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Live</span>
              </div>
            )}
            {answer.isRecording && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2 py-2 bg-red-500/80 rounded-lg">
                <Mic className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">
                  Recording {gestureReady ? '(tracking gestures)' : 'answer...'}
                </span>
              </div>
            )}
          </div>

          {showInterview && (
            <div className="flex flex-col gap-4">
              <Card variant="default" padding="md" className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-4 right-4 px-2.5"
                  onClick={() => playQuestionAudio(questions[currentQuestionIndex])}
                  disabled={isPlayingAudio || answer.isMicActive}
                  aria-label="Play question narration"
                >
                  <Volume2 className={`w-5 h-5 ${isPlayingAudio ? 'animate-pulse' : ''}`} />
                </Button>
                <p className="text-xs uppercase tracking-wide text-brand/80 mb-2 pr-12">
                  Interview question
                </p>
                <h2 className="text-xl text-white pr-12 leading-relaxed">
                  {questions[currentQuestionIndex]}
                </h2>
              </Card>

              <HybridAnswerInput
                value={answer.finalAnswer}
                onChange={answer.handleTextChange}
                onSelectCapture={answer.captureSelection}
                textareaRef={answer.textareaRef}
                recordingPhase={answer.recordingPhase}
                onStartRecording={() => {
                  if (!cameraReady) {
                    setError('Camera is not ready yet.');
                    return;
                  }
                  void answer.startRecording();
                }}
                onStopRecording={answer.stopRecording}
                onPauseRecording={answer.pauseRecording}
                onResumeRecording={answer.resumeRecording}
                placeholder="Type your answer, or record speech while the camera tracks gestures..."
                rows={5}
              />

              <Button fullWidth size="lg" disabled={!canSubmit} onClick={handleSubmitAnswer}>
                {currentQuestionIndex < questions.length - 1 ? 'Next question' : 'Finish interview'}
              </Button>

              {displayError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{displayError}</p>
                </div>
              )}

              <p className="text-center text-gray-500 text-sm">
                Answered {qaList.length} / {questions.length}
                {!gestureReady && ' · Gesture tracking loading…'}
              </p>
            </div>
          )}
        </div>
    </PageContainer>
  );
};

export default VideoInterviewScreen;

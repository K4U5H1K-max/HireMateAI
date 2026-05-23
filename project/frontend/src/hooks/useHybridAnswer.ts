import { useCallback, useMemo, useRef, useState } from 'react';
import { API_ENDPOINTS } from '../config/api';
import type { SpeechToTextResponse } from '../types';
import { appendTranscriptChunk, mergeHybridAnswer } from '../utils/mergeAnswer';

export type RecordingPhase = 'idle' | 'recording' | 'paused' | 'processing';

export interface UseHybridAnswerOptions {
  /** Provide mic stream (e.g. reuse camera stream audio in video interview). */
  getAudioStream?: () => Promise<MediaStream>;
  /** Release owned mic stream when a recording finishes (set false when reusing camera stream). */
  releaseStreamOnStop?: boolean;
  /** Fired when MediaRecorder starts (e.g. start gesture tracking). */
  onRecordingStart?: () => void;
  /** Fired when MediaRecorder stops, before transcription (e.g. stop gesture tracking). */
  onRecordingStop?: () => void;
}

export function useHybridAnswer(options: UseHybridAnswerOptions = {}) {
  const {
    getAudioStream,
    releaseStreamOnStop = true,
    onRecordingStart,
    onRecordingStop,
  } = options;

  const [typedText, setTypedText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>('idle');
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ownsStreamRef = useRef(false);

  // While true, transcript chunks queue instead of updating visible text (avoids cursor jumps).
  const isUserTypingRef = useRef(false);
  const pendingTranscriptRef = useRef('');
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  const finalAnswer = useMemo(
    () => mergeHybridAnswer(typedText, transcriptText),
    [typedText, transcriptText]
  );

  const isRecording = recordingPhase === 'recording';
  const isPaused = recordingPhase === 'paused';
  const isProcessing = recordingPhase === 'processing';
  const isMicActive = isRecording || isPaused;

  const captureSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
  }, []);

  const flushPendingTranscript = useCallback(() => {
    const pending = pendingTranscriptRef.current.trim();
    if (!pending) return;
    pendingTranscriptRef.current = '';
    setTranscriptText((prev) => appendTranscriptChunk(prev, pending));
  }, []);

  const markUserTyping = useCallback(() => {
    isUserTypingRef.current = true;
    captureSelection();
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
    typingIdleTimerRef.current = setTimeout(() => {
      isUserTypingRef.current = false;
      flushPendingTranscript();
    }, 800);
  }, [captureSelection, flushPendingTranscript]);

  /**
   * Textarea is controlled by finalAnswer visually, but manual edits update typedText
   * and clear transcript separation so the user owns the full composed string.
   */
  const handleTextChange = useCallback(
    (value: string) => {
      markUserTyping();
      setTypedText(value);
      setTranscriptText('');
    },
    [markUserTyping]
  );

  const resetAnswer = useCallback(() => {
    setTypedText('');
    setTranscriptText('');
    setError('');
    selectionRef.current = null;
    pendingTranscriptRef.current = '';
    isUserTypingRef.current = false;
    if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current && ownsStreamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    ownsStreamRef.current = false;
  }, []);

  const applyTranscriptChunk = useCallback(
    (chunk: string) => {
      if (!chunk.trim()) return;

      if (isUserTypingRef.current) {
        // Buffer until typing pauses so the controlled textarea does not reset the cursor.
        pendingTranscriptRef.current = appendTranscriptChunk(
          pendingTranscriptRef.current,
          chunk
        );
        return;
      }

      const el = textareaRef.current;
      const sel = selectionRef.current;
      const base = mergeHybridAnswer(typedText, transcriptText);

      if (el && sel && document.activeElement === el) {
        const before = base.slice(0, sel.start);
        const after = base.slice(sel.end);
        const insert = appendTranscriptChunk(
          before.trimEnd() ? (before.endsWith(' ') ? before : `${before} `) : '',
          chunk
        );
        const merged = after.trimStart()
          ? `${insert}${insert.endsWith(' ') ? '' : ' '}${after}`
          : insert;
        setTypedText(merged);
        setTranscriptText('');
        const cursor = insert.length;
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(cursor, cursor);
        });
        return;
      }

      setTranscriptText((prev) => appendTranscriptChunk(prev, chunk));
    },
    [typedText, transcriptText]
  );

  const transcribeBlob = useCallback(
    async (audioBlob: Blob, filename = 'recording.webm') => {
      setRecordingPhase('processing');
      setError('');

      try {
        const formData = new FormData();
        formData.append('audio_file', audioBlob, filename);

        const res = await fetch(API_ENDPOINTS.speechToText, { method: 'POST', body: formData });
        const raw = await res.text();

        if (!res.ok) {
          try {
            const parsed = JSON.parse(raw);
            throw new Error(parsed.message || parsed.detail || raw);
          } catch (e) {
            if (e instanceof Error && e.message !== raw) throw e;
            throw new Error(raw || `HTTP ${res.status}`);
          }
        }

        const data: SpeechToTextResponse = JSON.parse(raw);
        if (data.success && data.transcription.trim()) {
          applyTranscriptChunk(data.transcription);
        } else if (!data.success) {
          setError(data.message || 'Could not understand audio');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription failed');
      } finally {
        setRecordingPhase('idle');
        if (releaseStreamOnStop) releaseStream();
      }
    },
    [applyTranscriptChunk, releaseStream, releaseStreamOnStop]
  );

  const startRecording = useCallback(async () => {
    if (isMicActive || isProcessing) return;

    try {
      setError('');
      captureSelection();

      const stream = getAudioStream
        ? await getAudioStream()
        : await navigator.mediaDevices.getUserMedia({ audio: true });

      streamRef.current = stream;
      ownsStreamRef.current = !getAudioStream;

      let mimeType = '';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        onRecordingStop?.();
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size > 0) {
          await transcribeBlob(blob);
        } else {
          setRecordingPhase('idle');
          if (releaseStreamOnStop) releaseStream();
        }
      };

      recorder.start();
      setRecordingPhase('recording');
      onRecordingStart?.();
    } catch (err) {
      console.error(err);
      setError('Microphone access failed. Check permissions.');
      setRecordingPhase('idle');
    }
  }, [
    captureSelection,
    getAudioStream,
    isMicActive,
    isProcessing,
    onRecordingStart,
    onRecordingStop,
    releaseStream,
    releaseStreamOnStop,
    transcribeBlob,
  ]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recordingPhase === 'idle' || recordingPhase === 'processing') return;

    try {
      if (recordingPhase === 'recording' || recordingPhase === 'paused') {
        recorder.stop();
      }
    } catch {
      setRecordingPhase('idle');
    }
  }, [recordingPhase]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recordingPhase === 'recording' && typeof recorder.pause === 'function') {
      recorder.pause();
      setRecordingPhase('paused');
    }
  }, [recordingPhase]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recordingPhase === 'paused' && typeof recorder.resume === 'function') {
      recorder.resume();
      setRecordingPhase('recording');
    }
  }, [recordingPhase]);

  const getSubmitAnswer = useCallback(() => {
    const pending = pendingTranscriptRef.current.trim();
    const combined = pending
      ? mergeHybridAnswer(finalAnswer, pending)
      : finalAnswer;
    return combined.trim();
  }, [finalAnswer]);

  return {
    typedText,
    transcriptText,
    finalAnswer,
    textareaRef,
    recordingPhase,
    isRecording,
    isPaused,
    isProcessing,
    isMicActive,
    error,
    setError,
    handleTextChange,
    markUserTyping,
    captureSelection,
    resetAnswer,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    getSubmitAnswer,
    releaseStream,
  };
}

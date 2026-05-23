import { type RefObject } from 'react';
import { Loader2, Mic, MicOff, Pause, Play } from 'lucide-react';
import type { RecordingPhase } from '../hooks/useHybridAnswer';
import Button from './ui/Button';
import { cn } from '../lib/cn';

interface HybridAnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCapture: () => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  recordingPhase: RecordingPhase;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  placeholder?: string;
  rows?: number;
  supportsPause?: boolean;
}

const HybridAnswerInput = ({
  value,
  onChange,
  onSelectCapture,
  textareaRef,
  recordingPhase,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  placeholder = 'Type your answer, or use the microphone to add speech...',
  rows = 6,
  supportsPause = true,
}: HybridAnswerInputProps) => {
  const isRecording = recordingPhase === 'recording';
  const isPaused = recordingPhase === 'paused';
  const isProcessing = recordingPhase === 'processing';
  const isMicActive = isRecording || isPaused;

  return (
    <div className="space-y-3">
      {isMicActive && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40"
          role="status"
          aria-live="polite"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-300 text-sm font-medium">
            {isPaused ? 'Recording paused — you can keep typing' : 'Recording — you can keep typing'}
          </span>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-muted border border-brand-border">
          <Loader2 className="w-4 h-4 text-brand animate-spin" />
          <span className="text-brand text-sm">Transcribing voice…</span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={onSelectCapture}
        onKeyUp={onSelectCapture}
        onClick={onSelectCapture}
        onFocus={onSelectCapture}
        rows={rows}
        placeholder={placeholder}
        className={cn(
          'w-full px-4 py-3 bg-surface-overlay border border-brand-border rounded-xl',
          'text-white placeholder:text-gray-500',
          'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/50',
          'resize-y min-h-[120px] transition-colors'
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        {!isMicActive && !isProcessing && (
          <Button variant="secondary" size="sm" onClick={onStartRecording}>
            <Mic className="w-4 h-4" />
            Record
          </Button>
        )}

        {isRecording && supportsPause && (
          <Button variant="secondary" size="sm" onClick={onPauseRecording} className="border-amber-500/50 text-amber-200">
            <Pause className="w-4 h-4" />
            Pause
          </Button>
        )}

        {isPaused && (
          <Button variant="secondary" size="sm" onClick={onResumeRecording}>
            <Play className="w-4 h-4" />
            Resume
          </Button>
        )}

        {isMicActive && (
          <Button variant="danger" size="sm" onClick={onStopRecording}>
            <MicOff className="w-4 h-4" />
            Stop
          </Button>
        )}
      </div>
    </div>
  );
};

export default HybridAnswerInput;

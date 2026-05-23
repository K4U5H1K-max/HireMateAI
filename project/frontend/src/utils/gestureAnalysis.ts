import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { NonverbalMetrics } from '../types';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Sample = {
  smile: boolean;
  gazeAway: boolean;
  leanForward: boolean;
  leanBack: boolean;
  pitch: number;
};

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function faceMetrics(landmarks: NormalizedLandmark[]) {
  const xs = landmarks.map((p) => p.x);
  const ys = landmarks.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 0.001);
  const height = Math.max(maxY - minY, 0.001);
  const centerX = (minX + maxX) / 2;

  const nose = landmarks[1];
  const chin = landmarks[152];
  const leftMouth = landmarks[61];
  const rightMouth = landmarks[291];
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];

  const mouthWidth = dist(leftMouth, rightMouth) / width;
  const mouthOpen = dist(upperLip, lowerLip) / height;
  const smile = mouthWidth > 0.42 && mouthOpen > 0.06;

  const yawOffset = Math.abs(nose.x - centerX) / width;
  const gazeAway = yawOffset > 0.12;

  const faceArea = width * height;
  const pitch = nose.y - chin.y;

  return { smile, gazeAway, faceArea, pitch };
}

function countNods(pitches: number[]): number {
  if (pitches.length < 8) return 0;
  let nods = 0;
  let state: 'neutral' | 'down' | 'up' = 'neutral';
  const baseline = pitches.slice(0, 5).reduce((a, b) => a + b, 0) / 5;

  for (const pitch of pitches) {
    const delta = pitch - baseline;
    if (state === 'neutral' && delta < -0.012) state = 'down';
    else if (state === 'down' && delta > 0.005) {
      state = 'up';
      nods += 1;
    } else if (state === 'up' && Math.abs(delta) < 0.008) state = 'neutral';
  }
  return nods;
}

function finalizeMetrics(samples: Sample[], durationSec: number): NonverbalMetrics {
  if (!samples.length) {
    return {
      duration_sec: Math.round(durationSec),
      smile_pct: 0,
      nod_count: 0,
      gaze_away_pct: 0,
      lean_forward_pct: 0,
      lean_back_pct: 0,
      engagement_score: 50,
    };
  }

  let leanForward = 0;
  let leanBack = 0;
  let smiles = 0;
  let gazeAway = 0;
  const pitches: number[] = [];

  for (const s of samples) {
    if (s.smile) smiles += 1;
    if (s.gazeAway) gazeAway += 1;
    if (s.leanForward) leanForward += 1;
    if (s.leanBack) leanBack += 1;
    pitches.push(s.pitch);
  }

  const n = samples.length;
  const smilePct = Math.round((smiles / n) * 100);
  const gazeAwayPct = Math.round((gazeAway / n) * 100);
  const leanForwardPct = Math.round((leanForward / n) * 100);
  const leanBackPct = Math.round((leanBack / n) * 100);
  const nodCount = countNods(pitches);

  const engagement = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        70 -
          gazeAwayPct * 0.35 -
          leanBackPct * 0.2 +
          smilePct * 0.15 +
          Math.min(nodCount, 5) * 4 -
          (leanForwardPct > 60 ? 10 : 0)
      )
    )
  );

  return {
    duration_sec: Math.round(durationSec),
    smile_pct: smilePct,
    nod_count: nodCount,
    gaze_away_pct: gazeAwayPct,
    lean_forward_pct: leanForwardPct,
    lean_back_pct: leanBackPct,
    engagement_score: engagement,
  };
}

export class GestureAnalyzer {
  private landmarker: FaceLandmarker | null = null;
  private initPromise: Promise<void> | null = null;
  private samples: Sample[] = [];
  private baselineArea: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private lastVideoTime = -1;

  async init(): Promise<void> {
    if (this.landmarker) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      })();
    }
    await this.initPromise;
  }

  start(video: HTMLVideoElement): void {
    this.samples = [];
    this.baselineArea = null;
    this.startedAt = Date.now();
    this.lastVideoTime = -1;

    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      if (!this.landmarker || video.readyState < 2) return;

      const timestamp = performance.now();
      if (video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = video.currentTime;

      try {
        const result = this.landmarker.detectForVideo(video, timestamp);
        const landmarks = result.faceLandmarks?.[0];
        if (!landmarks) return;

        const m = faceMetrics(landmarks);
        if (this.baselineArea === null) {
          this.baselineArea = m.faceArea;
        }

        const areaRatio = m.faceArea / (this.baselineArea || m.faceArea);
        const leanForward = areaRatio > 1.12;
        const leanBack = areaRatio < 0.88;

        this.samples.push({
          smile: m.smile,
          gazeAway: m.gazeAway,
          leanForward,
          leanBack,
          pitch: m.pitch,
        });
      } catch {
        /* skip frame */
      }
    }, 200);
  }

  stop(): NonverbalMetrics {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    const durationSec = (Date.now() - this.startedAt) / 1000;
    return finalizeMetrics(this.samples, durationSec);
  }
}

export function formatMetricsForPrompt(metrics: NonverbalMetrics, questionIndex: number): string {
  return (
    `Q${questionIndex + 1} body language: ` +
    `smile ${metrics.smile_pct}%, nods ${metrics.nod_count}, ` +
    `looking away ${metrics.gaze_away_pct}%, lean forward ${metrics.lean_forward_pct}%, ` +
    `lean back/away from camera ${metrics.lean_back_pct}%, engagement ${metrics.engagement_score}/100`
  );
}

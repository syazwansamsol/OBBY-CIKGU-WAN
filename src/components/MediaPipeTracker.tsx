import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  interpretHandLandmarks,
  interpretFaceNosePosition,
  MediaPipeGestureResult,
  Point3D,
  LaneIndex
} from '../game/rules';
import { Camera, CameraOff, Hand, Smile, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface MediaPipeTrackerProps {
  onGestureUpdate: (result: MediaPipeGestureResult) => void;
  onDirectQuizAnswer?: (optionIndex: 0 | 1 | 2) => void;
  activeLane: LaneIndex;
  isQuizActive: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
}

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

function buildSyntheticHandLandmarks(
  normX: number,
  normY: number,
  fingersRaised: number
): Point3D[] {
  // Construct 21 realistic MediaPipe hand landmarks centered around (rawX = 1 - normX, normY)
  const cx = 1 - normX;
  const cy = normY;
  const pts: Point3D[] = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));

  // Wrist & Palm
  pts[0] = { x: cx, y: cy + 0.16 };
  pts[1] = { x: cx - 0.05, y: cy + 0.12 };
  pts[2] = { x: cx - 0.08, y: cy + 0.07 };
  pts[3] = { x: cx - 0.10, y: cy + 0.03 };
  pts[4] = { x: cx - 0.12, y: cy - 0.01 };

  const fingerOffsets = [-0.045, -0.015, 0.015, 0.045];
  const mcpIndices = [5, 9, 13, 17];
  const pipIndices = [6, 10, 14, 18];
  const dipIndices = [7, 11, 15, 19];
  const tipIndices = [8, 12, 16, 20];

  for (let i = 0; i < 4; i++) {
    const fx = cx + fingerOffsets[i];
    const isUp = i < fingersRaised;
    pts[mcpIndices[i]] = { x: fx, y: cy + 0.03 };
    pts[pipIndices[i]] = { x: fx, y: cy - 0.03 };
    pts[dipIndices[i]] = { x: fx, y: isUp ? cy - 0.09 : cy + 0.01 };
    pts[tipIndices[i]] = { x: fx, y: isUp ? cy - 0.15 : cy + 0.04 };
  }

  return pts;
}

export const MediaPipeTracker: React.FC<MediaPipeTrackerProps> = ({
  onGestureUpdate,
  onDirectQuizAnswer,
  activeLane,
  isQuizActive,
  isOpen,
  onToggleOpen
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [trackingMode, setTrackingMode] = useState<'hand' | 'face'>('hand');
  const [cameraStatus, setCameraStatus] = useState<'sim' | 'loading' | 'active' | 'error'>('sim');
  const [statusMessage, setStatusMessage] = useState<string>('Mod Simulasi MediaPipe Aktif');
  const [lastGesture, setLastGesture] = useState<MediaPipeGestureResult>(() =>
    interpretHandLandmarks(buildSyntheticHandLandmarks(0.5, 0.55, 2), true)
  );
  const [simFingers, setSimFingers] = useState<number>(2);
  const [simPos, setSimPos] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.55 });

  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const onGestureRef = useRef(onGestureUpdate);
  onGestureRef.current = onGestureUpdate;

  // Draw the MediaPipe overlay (3 lane columns + jump bar + skeleton landmarks)
  const renderOverlay = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      gesture: MediaPipeGestureResult,
      landmarks?: Point3D[],
      videoEl?: HTMLVideoElement | null
    ) => {
      ctx.clearRect(0, 0, width, height);

      if (videoEl && videoEl.readyState >= 2) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, -width, 0, width, height);
        ctx.restore();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.fillRect(0, 0, width, height);
      } else {
        // Styled dark grid background for simulation mode
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < width; gx += 24) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, height);
          ctx.stroke();
        }
        for (let gy = 0; gy < height; gy += 24) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(width, gy);
          ctx.stroke();
        }
      }

      // Draw Jump Zone (Top 28%)
      const jumpY = height * 0.28;
      ctx.fillStyle = gesture.jumpRequested
        ? 'rgba(250, 204, 21, 0.28)'
        : 'rgba(250, 204, 21, 0.08)';
      ctx.fillRect(0, 0, width, jumpY);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, jumpY);
      ctx.lineTo(width, jumpY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('▲ ZON LOMPAT (ANGKAT TANGAN)', 8, 14);

      // Draw 3 Lane Dividers (A: 0..36%, B: 36..64%, C: 64..100%)
      const x1 = width * 0.36;
      const x2 = width * 0.64;

      const laneBounds = [
        { x: 0, w: x1, label: 'A (KIRI)', color: 'rgba(56, 189, 248, 0.22)' },
        { x: x1, w: x2 - x1, label: 'B (TENGAH)', color: 'rgba(251, 191, 36, 0.22)' },
        { x: x2, w: width - x2, label: 'C (KANAN)', color: 'rgba(52, 211, 153, 0.22)' }
      ];

      laneBounds.forEach((b, idx) => {
        if (gesture.lane === idx) {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x, jumpY, b.w, height - jumpY);
        }
        ctx.fillStyle = gesture.lane === idx ? '#ffffff' : 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(b.label, b.x + 8, height - 8);
      });

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
      ctx.beginPath();
      ctx.moveTo(x1, jumpY);
      ctx.lineTo(x1, height);
      ctx.moveTo(x2, jumpY);
      ctx.lineTo(x2, height);
      ctx.stroke();

      // Draw hand skeleton if available
      if (landmarks && landmarks.length >= 21) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        for (const [a, b] of HAND_CONNECTIONS) {
          const pa = landmarks[a];
          const pb = landmarks[b];
          if (!pa || !pb) continue;
          ctx.beginPath();
          ctx.moveTo((1 - pa.x) * width, pa.y * height);
          ctx.lineTo((1 - pb.x) * width, pb.y * height);
          ctx.stroke();
        }
        landmarks.forEach((pt, idx) => {
          const px = (1 - pt.x) * width;
          const py = pt.y * height;
          ctx.fillStyle = [4, 8, 12, 16, 20].includes(idx) ? '#facc15' : '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, [4, 8, 12, 16, 20].includes(idx) ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // Draw nose/face target reticle
        const px = gesture.normalizedX * width;
        const py = gesture.normalizedY * height;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    []
  );

  // Update simulation canvas whenever simPos / simFingers / trackingMode changes in 'sim' status
  useEffect(() => {
    if (cameraStatus !== 'sim') return;
    const landmarks =
      trackingMode === 'hand'
        ? buildSyntheticHandLandmarks(simPos.x, simPos.y, simFingers)
        : undefined;
    const result =
      trackingMode === 'hand' && landmarks
        ? interpretHandLandmarks(landmarks, true)
        : interpretFaceNosePosition({ x: 1 - simPos.x, y: simPos.y }, true);

    setLastGesture(result);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        renderOverlay(
          ctx,
          canvasRef.current.width,
          canvasRef.current.height,
          result,
          landmarks,
          null
        );
      }
    }
  }, [cameraStatus, simPos, simFingers, trackingMode, renderOverlay]);

  const stopWebcam = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraStatus('sim');
    setStatusMessage('Mod Simulasi MediaPipe Aktif');
  }, []);

  const startWebcam = useCallback(async () => {
    setCameraStatus('loading');
    setStatusMessage('Memuatkan model MediaPipe Vision...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      if (trackingMode === 'hand' && !handLandmarkerRef.current) {
        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numHands: 1
        });
      } else if (trackingMode === 'face' && !faceLandmarkerRef.current) {
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1
        });
      }

      setCameraStatus('active');
      setStatusMessage(
        trackingMode === 'hand'
          ? 'MediaPipe HandLandmarker Aktif'
          : 'MediaPipe FaceLandmarker Aktif'
      );

      let lastVideoTime = -1;
      const detectLoop = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const nowMs = performance.now();
          let gesture: MediaPipeGestureResult | null = null;
          let drawnLandmarks: Point3D[] | undefined;

          if (trackingMode === 'hand' && handLandmarkerRef.current) {
            const res = handLandmarkerRef.current.detectForVideo(video, nowMs);
            if (res.landmarks && res.landmarks.length > 0) {
              drawnLandmarks = res.landmarks[0];
              gesture = interpretHandLandmarks(drawnLandmarks, true);
            }
          } else if (trackingMode === 'face' && faceLandmarkerRef.current) {
            const res = faceLandmarkerRef.current.detectForVideo(video, nowMs);
            if (res.faceLandmarks && res.faceLandmarks.length > 0) {
              const nose = res.faceLandmarks[0][1] || res.faceLandmarks[0][0];
              if (nose) {
                gesture = interpretFaceNosePosition(nose, true);
              }
            }
          }

          if (gesture) {
            setLastGesture(gesture);
            onGestureRef.current(gesture);
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            renderOverlay(
              ctx,
              canvas.width,
              canvas.height,
              gesture || lastGesture,
              drawnLandmarks,
              video
            );
          }
        }
        rafRef.current = requestAnimationFrame(detectLoop);
      };

      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      console.warn('Kamera tidak tersedia, beralih ke Mod Simulasi MediaPipe:', err);
      setCameraStatus('sim');
      setStatusMessage('Kamera tiada · Pad Simulasi MediaPipe Aktif');
    }
  }, [trackingMode, renderOverlay, lastGesture]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const triggerSimulatedGesture = (
    nx: number,
    ny: number,
    fingers: number,
    quizAnswer?: 0 | 1 | 2
  ) => {
    setSimPos({ x: nx, y: ny });
    setSimFingers(fingers);
    const landmarks = buildSyntheticHandLandmarks(nx, ny, fingers);
    const res =
      trackingMode === 'hand'
        ? interpretHandLandmarks(landmarks, true)
        : interpretFaceNosePosition({ x: 1 - nx, y: ny }, true);
    setLastGesture(res);
    onGestureUpdate(res);
    if (quizAnswer !== undefined && isQuizActive && onDirectQuizAnswer) {
      onDirectQuizAnswer(quizAnswer);
    }
  };

  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (cameraStatus !== 'sim') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0.08, Math.min(0.92, (e.clientY - rect.top) / rect.height));
    const autoFingers = nx < 0.36 ? 1 : nx > 0.64 ? 3 : 2;
    triggerSimulatedGesture(nx, ny, autoFingers);
  };

  return (
    <aside
      aria-label="Panel Penjejakan MediaPipe"
      className="fixed bottom-4 right-4 z-30 pointer-events-auto w-72 rounded-2xl bg-slate-900/95 border-2 border-sky-400/50 shadow-2xl overflow-hidden text-white"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-display font-bold text-xs tracking-wide text-sky-300">
            MEDIAPIPE TRACKER
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const nextMode = trackingMode === 'hand' ? 'face' : 'hand';
              setTrackingMode(nextMode);
            }}
            aria-label="Tukar mod penjejakan Tangan atau Kepala"
            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            {trackingMode === 'hand' ? (
              <>
                <Hand className="w-3 h-3 text-amber-400" />
                <span>Tangan</span>
              </>
            ) : (
              <>
                <Smile className="w-3 h-3 text-emerald-400" />
                <span>Kepala</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onToggleOpen}
            aria-label={isOpen ? 'Sembunyikan panel MediaPipe' : 'Buka panel MediaPipe'}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-3 space-y-2.5">
          {/* Hidden video element for MediaPipe webcam stream */}
          <video ref={videoRef} className="hidden" playsInline muted />

          {/* Interactive Tracking / Simulation Viewport */}
          <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
            <canvas
              ref={canvasRef}
              width={260}
              height={150}
              onPointerDown={handleCanvasPointer}
              onPointerMove={(e) => {
                if (e.buttons === 1) handleCanvasPointer(e);
              }}
              aria-label="Kanvas Penjejakan MediaPipe (Klik atau seret untuk simulasi gerakan tangan)"
              className="w-full h-[136px] block cursor-crosshair touch-none"
            />
            <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono text-slate-300">
              {cameraStatus === 'active' ? 'LIVE CAM' : 'SIMULASI AI'}
            </div>
          </div>

          {/* Detected Gesture Readout */}
          <div className="flex items-center justify-between text-xs bg-slate-950/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 text-[11px]">Isyarat:</span>
            <span
              data-testid="mediapipe-gesture-readout"
              className="font-bold text-amber-300 truncate max-w-[175px]"
            >
              {lastGesture.gestureLabel}
            </span>
          </div>

          {/* Quick Gesture / Lane Action Buttons (Works both as MediaPipe Sim & Accessibility Control) */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => triggerSimulatedGesture(0.18, 0.55, 1, 0)}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap ${
                activeLane === 0
                  ? 'bg-sky-500 text-slate-950 border-sky-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border-slate-700'
              }`}
            >
              1 Jari (A)
            </button>
            <button
              type="button"
              onClick={() => triggerSimulatedGesture(0.5, 0.55, 2, 1)}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap ${
                activeLane === 1
                  ? 'bg-amber-400 text-slate-950 border-amber-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
              }`}
            >
              2 Jari (B)
            </button>
            <button
              type="button"
              onClick={() => triggerSimulatedGesture(0.82, 0.55, 3, 2)}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap ${
                activeLane === 2
                  ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
              }`}
            >
              3 Jari (C)
            </button>
            <button
              type="button"
              onClick={() =>
                triggerSimulatedGesture(
                  activeLane === 0 ? 0.18 : activeLane === 2 ? 0.82 : 0.5,
                  0.16,
                  4
                )
              }
              className="py-1.5 px-1 rounded-lg text-[11px] font-bold bg-purple-600 hover:bg-purple-500 text-white border border-purple-400 whitespace-nowrap"
            >
              Lompat ▲
            </button>
          </div>

          {/* Camera Toggle Button */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[10px] text-slate-400 truncate">{statusMessage}</span>
            {cameraStatus === 'active' ? (
              <button
                type="button"
                onClick={stopWebcam}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <CameraOff className="w-3.5 h-3.5" />
                <span>Tutup Cam</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startWebcam}
                disabled={cameraStatus === 'loading'}
                className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{cameraStatus === 'loading' ? 'Memuat...' : 'Buka Kamera'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

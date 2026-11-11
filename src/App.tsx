import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ObbyCanvas,
  GameState,
  ActiveQuizBannerState,
  QuizFeedbackToast
} from './components/ObbyCanvas';
import { MediaPipeTracker } from './components/MediaPipeTracker';
import { KamusModal } from './components/KamusModal';
import {
  LaneIndex,
  MediaPipeGestureResult,
  updatePlayerVitality,
  checkMissionCompletion,
  getQuestionsForMode,
  formatTimeMMSS
} from './game/rules';
import { soundEngine } from './game/sound';
import {
  BookOpen,
  Volume2,
  VolumeX,
  Pause,
  RotateCcw,
  Camera,
  Trophy,
  CheckSquare,
  Square
} from 'lucide-react';

// Code-authored 3-state Vitality Heart SVG (Full, Cracked, Empty Hollow Socket)
const VitalityHeartSvg: React.FC<{ state: 'full' | 'cracked' | 'empty' }> = ({ state }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7 drop-shadow"
      aria-label={`Nyawa: ${state}`}
    >
      {/* Dark outer silhouette */}
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={state === 'empty' ? '#1e293b' : state === 'cracked' ? '#f97316' : '#ef4444'}
        stroke="#0f172a"
        strokeWidth="2.2"
      />
      {/* Top specular highlight */}
      {state !== 'empty' && (
        <path
          d="M7.5 5.2c-1.8 0-3.2 1.4-3.2 3.2 0 .6.2 1.2.5 1.7"
          fill="none"
          stroke="#fecaca"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
      {/* Crack line when damaged */}
      {state === 'cracked' && (
        <path
          d="M12 5.5l-1.8 4.2 2.4 2.1-1.9 5.5"
          fill="none"
          stroke="#0f172a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

// Bespoke Inline SVG Roblox-Style Emblem Lockup for Title Screen
const ObbyTitleLockupSvg: React.FC = () => (
  <svg
    viewBox="0 0 620 135"
    className="w-full max-w-[540px] h-auto select-none drop-shadow-xl"
    role="img"
    aria-label="Obby Kuiz: Pustaka Mini Keluarga"
  >
    {/* Tilted Red Roblox-Style Cube Icon */}
    <g transform="translate(22, 18) rotate(-10, 42, 42)">
      <rect
        x="4"
        y="4"
        width="76"
        height="76"
        rx="14"
        fill="#ef4444"
        stroke="#0f172a"
        strokeWidth="7"
      />
      <rect x="10" y="10" width="64" height="16" rx="6" fill="#f87171" />
      <rect
        x="27"
        y="27"
        width="30"
        height="30"
        rx="4"
        fill="#ffffff"
        stroke="#0f172a"
        strokeWidth="4"
      />
      <rect x="36" y="36" width="12" height="12" fill="#ef4444" />
    </g>

    {/* Main Display Title Text */}
    <g transform="translate(120, 12)">
      <text
        x="0"
        y="52"
        fontFamily="'Fredoka', sans-serif"
        fontWeight="700"
        fontSize="54"
        fill="#facc15"
        stroke="#0f172a"
        strokeWidth="10"
        paintOrder="stroke fill"
        letterSpacing="1.5"
      >
        OBBY KUIZ 3D
      </text>
      <rect
        x="2"
        y="68"
        width="465"
        height="38"
        rx="10"
        fill="#0284c7"
        stroke="#0f172a"
        strokeWidth="5"
      />
      <text
        x="232"
        y="93"
        textAnchor="middle"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontWeight="800"
        fontSize="19"
        fill="#ffffff"
        letterSpacing="1.2"
      >
        PUSTAKA MINI KELUARGA &amp; ALAM BERSIH
      </text>
    </g>
  </svg>
);

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [gameMode, setGameMode] = useState<'pustaka' | 'sains' | 'campuran'>('pustaka');
  const [targetLane, setTargetLane] = useState<LaneIndex>(1);
  const [jumpSignal, setJumpSignal] = useState<number>(0);
  const [directAnswerSignal, setDirectAnswerSignal] = useState<{
    option: 0 | 1 | 2;
    seq: number;
  } | null>(null);
  const [runId, setRunId] = useState<number>(1);

  const [muted, setMuted] = useState<boolean>(false);
  const [kamusOpen, setKamusOpen] = useState<boolean>(false);
  const [trackerOpen, setTrackerOpen] = useState<boolean>(true);

  const [hudState, setHudState] = useState<{
    score: number;
    hp: number;
    itemsCollected: number;
    quizzesAnswered: number;
    quizzesCorrect: number;
    streak: number;
    elapsedSeconds: number;
    progressPercent: number;
    activeQuiz: ActiveQuizBannerState | null;
  }>({
    score: 0,
    hp: 6,
    itemsCollected: 0,
    quizzesAnswered: 0,
    quizzesCorrect: 0,
    streak: 0,
    elapsedSeconds: 0,
    progressPercent: 0,
    activeQuiz: null
  });

  const [feedbackToast, setFeedbackToast] = useState<QuizFeedbackToast | null>(null);
  const [endResult, setEndResult] = useState<{
    victory: boolean;
    finalScore: number;
    elapsedSeconds: number;
    itemsCollected: number;
    quizzesCorrect: number;
    totalQuizzes: number;
  } | null>(null);
  const [bestScore, setBestScore] = useState<number>(0);

  const lastJumpGestureTimeRef = useRef<number>(0);

  // Sync gameState to document.body.dataset.state per game_title_and_hud.md
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  const startNewGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const modeQuestions = getQuestionsForMode(gameMode);
    setEndResult(null);
    setFeedbackToast(null);
    setTargetLane(1);
    setHudState({
      score: 0,
      hp: 6,
      itemsCollected: 0,
      quizzesAnswered: 0,
      quizzesCorrect: 0,
      streak: 0,
      elapsedSeconds: 0,
      progressPercent: 0,
      activeQuiz: modeQuestions[0]
        ? {
            gateIndex: 1,
            totalGates: 5,
            question: modeQuestions[0],
            distanceMeters: 34
          }
        : null
    });
    setRunId((r) => r + 1);
    setGameState('playing');
    document.body.dataset.state = 'playing';
  }, [gameMode]);

  const handleDirectAnswer = useCallback((opt: 0 | 1 | 2) => {
    setTargetLane(opt);
    soundEngine.playLaneShift();
    setDirectAnswerSignal((prev) => ({ option: opt, seq: (prev?.seq || 0) + 1 }));
  }, []);

  // Unified Keyboard Input Listener (WASD / Arrows / Space / Enter / Escape / P / K / M / 1-2-3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (kamusOpen) {
        if (e.key === 'Escape') setKamusOpen(false);
        return;
      }

      if (gameState === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (gameState === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setGameState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
        return;
      }

      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setKamusOpen((v) => !v);
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setMuted((m) => {
          const next = !m;
          soundEngine.muted = next;
          return next;
        });
        return;
      }

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        startNewGame();
        return;
      }

      if (gameState !== 'playing') return;

      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setTargetLane((prev) => {
          const next = Math.max(0, prev - 1) as LaneIndex;
          if (next !== prev) soundEngine.playLaneShift();
          return next;
        });
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setTargetLane((prev) => {
          const next = Math.min(2, prev + 1) as LaneIndex;
          if (next !== prev) soundEngine.playLaneShift();
          return next;
        });
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        setJumpSignal((s) => s + 1);
      } else if (e.key === '1') {
        e.preventDefault();
        handleDirectAnswer(0);
      } else if (e.key === '2') {
        e.preventDefault();
        handleDirectAnswer(1);
      } else if (e.key === '3') {
        e.preventDefault();
        handleDirectAnswer(2);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, kamusOpen, startNewGame, handleDirectAnswer]);

  // MediaPipe Gesture Callback
  const handleMediaPipeGesture = useCallback((res: MediaPipeGestureResult) => {
    setTargetLane((prev) => {
      if (prev !== res.lane) {
        soundEngine.playLaneShift();
      }
      return res.lane;
    });

    const now = performance.now();
    if (res.jumpRequested && now - lastJumpGestureTimeRef.current > 650) {
      lastJumpGestureTimeRef.current = now;
      setJumpSignal((s) => s + 1);
    }
  }, []);

  const handleQuizFeedback = useCallback((toast: QuizFeedbackToast) => {
    setFeedbackToast(toast);
    window.setTimeout(() => {
      setFeedbackToast((curr) => (curr === toast ? null : curr));
    }, 3400);
  }, []);

  const handleGameEnd = useCallback(
    (result: {
      victory: boolean;
      finalScore: number;
      elapsedSeconds: number;
      itemsCollected: number;
      quizzesCorrect: number;
      totalQuizzes: number;
    }) => {
      setEndResult(result);
      setBestScore((prev) => Math.max(prev, result.finalScore));
      setGameState('gameover');
    },
    []
  );

  const questions = getQuestionsForMode(gameMode);
  const vitality = updatePlayerVitality(hudState.hp, 0, 6);
  const missions = checkMissionCompletion({
    itemsCollected: hudState.itemsCollected,
    targetItems: 10,
    quizzesAnswered: hudState.quizzesAnswered,
    quizzesCorrect: hudState.quizzesCorrect,
    targetQuizzes: 5,
    reachedFinish: endResult?.victory ?? false
  });

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* 1. Isolated Full-Viewport 3D WebGL Obby World */}
      <ObbyCanvas
        gameState={kamusOpen && gameState === 'playing' ? 'paused' : gameState}
        targetLane={targetLane}
        onLaneChange={(l) => setTargetLane(l)}
        jumpSignal={jumpSignal}
        directAnswerSignal={directAnswerSignal}
        questions={questions}
        runId={runId}
        onHudUpdate={setHudState}
        onQuizFeedback={handleQuizFeedback}
        onGameEnd={handleGameEnd}
      />

      {/* 2. TITLE SCREEN OVERLAY */}
      {gameState === 'title' && (
        <section
          aria-label="Skrin Utama Obby Kuiz"
          className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/75"
        >
          {/* Top Bar on Title Screen: Topic Info & Kamus Reference Button */}
          <div className="flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
            <div className="px-4 py-2 rounded-2xl bg-slate-900/95 border-2 border-amber-400/60 shadow-lg flex items-center gap-3">
              <span className="font-display font-bold text-sm text-amber-300">
                BAHASA MELAYU (KPM) · UNIT PUSTAKA MINI KELUARGA
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-xs font-semibold text-sky-300">
                Penjejakan Kamera MediaPipe AI
              </span>
            </div>

            <button
              type="button"
              onClick={() => setKamusOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm border-2 border-white shadow-lg flex items-center gap-2 transition-transform active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span>Baca Petikan &amp; Kamus Dewan</span>
            </button>
          </div>

          {/* Center-Left Negative Space Lockup & Primary Start CTA */}
          <div className="my-auto max-w-xl space-y-5 pointer-events-auto">
            <ObbyTitleLockupSvg />

            <p className="text-sm md:text-base text-slate-100 font-medium bg-slate-950/85 p-4 rounded-2xl border border-slate-800 leading-relaxed">
              Kawal watak 3D Kishan merentasi halangan <strong>Obby Pustaka Mini</strong> menggunakan{' '}
              <strong className="text-sky-300">Penjejakan Tangan/Kepala MediaPipe</strong> atau papan
              kekunci. Kutip buku ilmu dan lari menembusi{' '}
              <strong className="text-amber-300">Pintu Kuiz A, B, atau C</strong> untuk menjawab maksud
              kosa kata seperti <em>jinjing</em>, <em>kandar</em>, <em>tatang</em>, dan <em>pangku</em>!
            </p>

            {/* Mode Selector (Segmented Control) */}
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-300">Pilih Modul Soalan Kuiz:</div>
              <div className="inline-flex flex-wrap gap-2 p-1.5 rounded-2xl bg-slate-900/95 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setGameMode('pustaka')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    gameMode === 'pustaka'
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  BM: Pustaka Mini &amp; Kamus Dewan
                </button>
                <button
                  type="button"
                  onClick={() => setGameMode('sains')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    gameMode === 'sains'
                      ? 'bg-emerald-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Sains Tahun 6: Alam Sekitar
                </button>
                <button
                  type="button"
                  onClick={() => setGameMode('campuran')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                    gameMode === 'campuran'
                      ? 'bg-sky-400 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Campuran (BM + Sains)
                </button>
              </div>
            </div>

            {/* Primary & Secondary Actions (<= 3 actions total) */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={startNewGame}
                className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xl tracking-wide border-b-4 border-emerald-700 shadow-xl transition-transform active:scale-95 cursor-pointer"
              >
                MULA GAME (ENTER)
              </button>

              <button
                type="button"
                onClick={() => setKamusOpen(true)}
                className="px-5 py-4 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-amber-300 font-display font-bold text-base border-2 border-amber-400/60 shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                Nota Kamus (m/s 538–539)
              </button>
            </div>
          </div>

          {/* Flat Single-Line Control Hint in Bottom Safe Margin */}
          <div className="text-xs md:text-sm font-semibold text-slate-300 tracking-wide">
            A / D atau Anak Panah Tukar Laluan · Space Lompat · 1 / 2 / 3 Jawab Pintu A/B/C · Isyarat Tangan MediaPipe · Esc Jeda
          </div>
        </section>
      )}

      {/* 3. PLAYING HUD OVERLAY (Low-Occlusion Perimeter Clusters, >= 85% Clear Playfield) */}
      {gameState === 'playing' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-5">
          {/* Top Perimeter Row */}
          <div className="flex items-start justify-between gap-4">
            {/* Top-Left Cluster: Vitality Hearts + Skor & Masa */}
            <div className="pointer-events-auto flex flex-col gap-2 bg-slate-950/90 border-2 border-slate-700 rounded-2xl px-4 py-3 shadow-xl min-w-[210px]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1" data-testid="vitality-hearts">
                  {vitality.heartStates.map((st, idx) => (
                    <VitalityHeartSvg key={idx} state={st} />
                  ))}
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  NYAWA
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    SKOR
                  </div>
                  <div
                    data-testid="hud-score"
                    className="font-display text-2xl font-bold text-white tabular-nums leading-none mt-0.5"
                  >
                    {Math.round(hudState.score)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                    MASA
                  </div>
                  <div
                    data-testid="hud-timer"
                    className="font-mono text-lg font-bold text-slate-100 tabular-nums leading-none mt-1"
                  >
                    {formatTimeMMSS(hudState.elapsedSeconds)}
                  </div>
                </div>
              </div>
            </div>

            {/* Top-Center Active Quiz Checkpoint Banner (Appears when approaching a Quiz Archway) */}
            {hudState.activeQuiz && (
              <div
                data-testid="active-quiz-banner"
                className="pointer-events-auto max-w-2xl w-full bg-slate-950/95 border-2 border-amber-400 rounded-2xl p-4 shadow-2xl space-y-2.5 animate-fade-in"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display font-bold text-amber-300 uppercase tracking-wide">
                    PINTU KUIZ {hudState.activeQuiz.gateIndex}/{hudState.activeQuiz.totalGates} ·{' '}
                    {hudState.activeQuiz.question.contextHint}
                  </span>
                  <span className="font-mono font-bold text-sky-300 tabular-nums">
                    Jarak: {hudState.activeQuiz.distanceMeters}m
                  </span>
                </div>

                <h2 className="font-display text-base md:text-lg font-bold text-white leading-snug">
                  {hudState.activeQuiz.question.question}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {hudState.activeQuiz.question.options.map((optText, idx) => {
                    const gateLetters = ['A', 'B', 'C'];
                    const gateStyles = [
                      'border-sky-400 bg-sky-950/90 hover:bg-sky-900 text-sky-100',
                      'border-amber-400 bg-amber-950/90 hover:bg-amber-900 text-amber-100',
                      'border-emerald-400 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-100'
                    ];
                    const isSelectedLane = targetLane === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDirectAnswer(idx as 0 | 1 | 2)}
                        className={`p-2.5 rounded-xl border-2 text-left transition-transform active:scale-95 flex items-start gap-2 cursor-pointer ${
                          gateStyles[idx]
                        } ${isSelectedLane ? 'ring-2 ring-white scale-[1.02]' : ''}`}
                      >
                        <span className="w-6 h-6 rounded-lg bg-slate-950 text-white font-display font-bold text-xs flex items-center justify-center shrink-0">
                          {gateLetters[idx]}
                        </span>
                        <span className="text-xs font-semibold leading-tight">{optText}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top-Right Cluster: Compact Utility Icon Buttons + Misi Checklist Card */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <div className="flex items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-700">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setKamusOpen(true);
                  }}
                  aria-label="Buka Nota Kamus [K]"
                  title="Nota & Kamus Dewan [K]"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 flex items-center gap-1 text-xs font-bold"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">Kamus [K]</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setTrackerOpen((v) => !v);
                  }}
                  aria-label="Togol Panel Kamera MediaPipe [C]"
                  title="Panel MediaPipe"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setMuted((m) => {
                      const next = !m;
                      soundEngine.muted = next;
                      return next;
                    });
                  }}
                  aria-label={muted ? 'Buka Bunyi [M]' : 'Senyapkan Bunyi [M]'}
                  title="Bunyi [M]"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setGameState('paused');
                  }}
                  aria-label="Jeda Permainan [P]"
                  title="Jeda [P]"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <Pause className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    startNewGame();
                  }}
                  aria-label="Mula Semula [R]"
                  title="Mula Semula [R]"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Roblox-Style Misi Card (Matches Image 1) */}
              <div className="bg-slate-950/90 border-2 border-sky-400/50 rounded-2xl p-3 shadow-xl w-56 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-display font-bold text-xs tracking-wider text-sky-300 uppercase">
                    MISI OBBY
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
                    {hudState.progressPercent}%
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs">
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      {missions.mission1CollectDone ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span>Kutip 10 Buku/Koin</span>
                    </span>
                    <span className="font-mono font-bold text-amber-300 tabular-nums">
                      {hudState.itemsCollected}/10
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      {missions.mission2QuizDone ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span>Kuiz Kamus Tepat</span>
                    </span>
                    <span className="font-mono font-bold text-sky-300 tabular-nums">
                      {hudState.quizzesCorrect}/5
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      {missions.mission3FinishDone ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span>Garisan Penamat</span>
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Feedback Toast after passing a Quiz Gate */}
          {feedbackToast && (
            <div
              role="status"
              className={`mx-auto max-w-md px-5 py-3 rounded-2xl border-2 shadow-2xl text-center space-y-1 ${
                feedbackToast.isCorrect
                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100'
                  : 'bg-rose-950/95 border-rose-400 text-rose-100'
              }`}
            >
              <div className="font-display font-bold text-sm uppercase">
                {feedbackToast.isCorrect
                  ? `TEPAT SEKALI! (+${feedbackToast.scoreDelta} Skor) · "${feedbackToast.word}"`
                  : `KURang TEPAT! · Kata Kunci: "${feedbackToast.word}"`}
              </div>
              <p className="text-xs text-slate-200">{feedbackToast.explanation}</p>
            </div>
          )}

          {/* Bottom-Left Quick On-Screen Controls (Complementing Bottom-Right MediaPipe Tracker) */}
          <div className="flex items-end justify-between">
            <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/90 p-2 rounded-2xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setTargetLane(0);
                  soundEngine.playLaneShift();
                }}
                className={`px-3.5 py-2 rounded-xl font-display font-bold text-xs border transition-colors ${
                  targetLane === 0
                    ? 'bg-sky-400 text-slate-950 border-white'
                    : 'bg-slate-800 text-sky-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                ◄ Laluan A
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetLane(1);
                  soundEngine.playLaneShift();
                }}
                className={`px-3.5 py-2 rounded-xl font-display font-bold text-xs border transition-colors ${
                  targetLane === 1
                    ? 'bg-amber-400 text-slate-950 border-white'
                    : 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                ● Laluan B
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetLane(2);
                  soundEngine.playLaneShift();
                }}
                className={`px-3.5 py-2 rounded-xl font-display font-bold text-xs border transition-colors ${
                  targetLane === 2
                    ? 'bg-emerald-400 text-slate-950 border-white'
                    : 'bg-slate-800 text-emerald-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Laluan C ►
              </button>
              <button
                type="button"
                onClick={() => setJumpSignal((s) => s + 1)}
                className="px-4 py-2 rounded-xl font-display font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white border border-purple-300"
              >
                LOMPAT (SPACE)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MEDIAPIPE CAMERA & GESTURE TRACKER PIP (Always mounted so webcam stream persists across states) */}
      <MediaPipeTracker
        onGestureUpdate={handleMediaPipeGesture}
        onDirectQuizAnswer={handleDirectAnswer}
        activeLane={targetLane}
        isQuizActive={Boolean(hudState.activeQuiz)}
        isOpen={trackerOpen}
        onToggleOpen={() => setTrackerOpen((v) => !v)}
      />

      {/* 5. PAUSE MODAL */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Permainan Dijeda"
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 pointer-events-auto"
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border-2 border-sky-400 p-6 text-center space-y-5 shadow-2xl">
            <h2 className="font-display text-3xl font-bold text-amber-300">PERMAINAN DIJEDA</h2>

            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">SKOR</div>
                <div className="font-display text-xl font-bold text-white tabular-nums">
                  {Math.round(hudState.score)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">KUIZ TEPAT</div>
                <div className="font-display text-xl font-bold text-emerald-400 tabular-nums">
                  {hudState.quizzesCorrect}/5
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">MASA</div>
                <div className="font-mono text-lg font-bold text-sky-300 tabular-nums">
                  {formatTimeMMSS(hudState.elapsedSeconds)}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base"
              >
                Sambung Main (Esc / P)
              </button>
              <button
                type="button"
                onClick={startNewGame}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base"
              >
                Mula Semula
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-display font-bold text-sm"
              >
                Menu Utama
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. VICTORY / GAME OVER MODAL */}
      {gameState === 'gameover' && endResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={endResult.victory ? 'Tahniah Misi Berjaya' : 'Permainan Tamat'}
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 pointer-events-auto"
        >
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border-2 border-amber-400 p-7 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-amber-300">
              <Trophy className="w-9 h-9" />
            </div>

            <div>
              <h2 className="font-display text-3xl font-bold text-amber-300">
                {endResult.victory
                  ? 'TAHNIAH! Misi Pustaka & Alam Berjaya!'
                  : 'CUBA LAGI! Jangan Putus Asa'}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                {endResult.victory
                  ? 'Anda berjaya menamatkan cabaran Obby Kuiz Pustaka Mini Keluarga!'
                  : 'Rujuk Kamus Pelajar Bahasa Melayu Dewan untuk menguasai kosa kata.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">SKOR AKHIR</div>
                <div className="font-display text-2xl font-bold text-amber-300 tabular-nums">
                  {Math.round(endResult.finalScore)}
                </div>
                <div className="text-[10px] text-slate-400 tabular-nums">
                  Terbaik: {Math.round(bestScore)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">KUIZ TEPAT</div>
                <div className="font-display text-2xl font-bold text-emerald-400 tabular-nums">
                  {endResult.quizzesCorrect}/{endResult.totalQuizzes}
                </div>
                <div className="text-[10px] text-slate-400 tabular-nums">
                  Buku/Koin: {endResult.itemsCollected}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">MASA</div>
                <div className="font-mono text-xl font-bold text-sky-300 tabular-nums mt-1">
                  {formatTimeMMSS(endResult.elapsedSeconds)}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                data-start="true"
                onClick={startNewGame}
                className="flex-1 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-base cursor-pointer"
              >
                Main Semula (Enter)
              </button>
              <button
                type="button"
                onClick={() => setKamusOpen(true)}
                className="px-5 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
              >
                Semak Kamus Dewan
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-display font-bold text-sm cursor-pointer"
              >
                Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. INTERACTIVE PETIKAN BUKU TEKS & KAMUS DEWAN MODAL */}
      <KamusModal isOpen={kamusOpen} onClose={() => setKamusOpen(false)} />
    </main>
  );
}

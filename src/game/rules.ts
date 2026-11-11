import { QUIZ_QUESTIONS, QuizQuestion } from './quizData';

export type LaneIndex = 0 | 1 | 2; // 0 = Kiri (A), 1 = Tengah (B), 2 = Kanan (C)

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export interface MediaPipeGestureResult {
  lane: LaneIndex;
  jumpRequested: boolean;
  fingerCount: number;
  selectedOption: 0 | 1 | 2 | null;
  gestureLabel: string;
  normalizedX: number;
  normalizedY: number;
}

export interface MissionProgress {
  itemsCollected: number;
  targetItems: number;
  quizzesAnswered: number;
  quizzesCorrect: number;
  targetQuizzes: number;
  reachedFinish: boolean;
}

export const LANE_WORLD_X: Record<LaneIndex, number> = {
  0: -3.2,
  1: 0,
  2: 3.2
};

export const LANE_LABELS: Record<LaneIndex, string> = {
  0: 'Laluan A (Kiri)',
  1: 'Laluan B (Tengah)',
  2: 'Laluan C (Kanan)'
};

/**
 * Converts normalized X coordinate (0..1, already mirrored for user facing camera)
 * into one of the 3 Obby lanes: 0 (Left / A), 1 (Center / B), 2 (Right / C).
 */
export function laneFromNormalizedX(mirroredX: number): LaneIndex {
  const clamped = Math.max(0, Math.min(1, mirroredX));
  if (clamped < 0.36) return 0;
  if (clamped > 0.64) return 2;
  return 1;
}

/**
 * Counts extended fingers from 21 MediaPipe hand landmarks and extracts
 * lane steering + jump/answer intent.
 * Note: landmarks[0] is wrist, [8] index tip, [6] index PIP, [12] middle tip, [10] middle PIP,
 * [16] ring tip, [14] ring PIP, [20] pinky tip, [18] pinky PIP.
 */
export function interpretHandLandmarks(landmarks: Point3D[], mirrorX = true): MediaPipeGestureResult {
  if (!landmarks || landmarks.length < 21) {
    return {
      lane: 1,
      jumpRequested: false,
      fingerCount: 0,
      selectedOption: null,
      gestureLabel: 'Tiada Tangan Dikesan',
      normalizedX: 0.5,
      normalizedY: 0.5
    };
  }

  const wrist = landmarks[0];
  const palmCenter = landmarks[9] || wrist;
  const rawX = palmCenter.x;
  const mirroredX = mirrorX ? 1 - rawX : rawX;
  const normalizedY = palmCenter.y;

  const lane = laneFromNormalizedX(mirroredX);

  // Count raised non-thumb fingers (index, middle, ring, pinky)
  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];
  let raisedFingers = 0;

  for (let i = 0; i < 4; i++) {
    const tip = landmarks[fingerTips[i]];
    const pip = landmarks[fingerPips[i]];
    if (tip && pip && tip.y < pip.y - 0.025) {
      raisedFingers++;
    }
  }

  // Jump if hand is raised high in upper 28% of frame or all 4 fingers open high
  const jumpRequested = normalizedY < 0.28 || raisedFingers === 4;

  let selectedOption: 0 | 1 | 2 | null = null;
  if (raisedFingers === 1) selectedOption = 0; // 1 Jari -> Jawapan A
  else if (raisedFingers === 2) selectedOption = 1; // 2 Jari -> Jawapan B
  else if (raisedFingers === 3) selectedOption = 2; // 3 Jari -> Jawapan C

  let gestureLabel = LANE_LABELS[lane];
  if (jumpRequested) {
    gestureLabel = `LOMPAT! · ${LANE_LABELS[lane]}`;
  } else if (selectedOption !== null) {
    const optLetter = ['A', 'B', 'C'][selectedOption];
    gestureLabel = `${raisedFingers} Jari (Pilih ${optLetter}) · ${LANE_LABELS[lane]}`;
  }

  return {
    lane,
    jumpRequested,
    fingerCount: raisedFingers,
    selectedOption,
    gestureLabel,
    normalizedX: mirroredX,
    normalizedY
  };
}

/**
 * Interprets head/nose position from MediaPipe FaceLandmarker or PoseLandmarker
 * for hands-free head-tilt Obby control.
 */
export function interpretFaceNosePosition(nose: Point3D, mirrorX = true): MediaPipeGestureResult {
  const mirroredX = mirrorX ? 1 - nose.x : nose.x;
  const normalizedY = nose.y;
  const lane = laneFromNormalizedX(mirroredX);
  const jumpRequested = normalizedY < 0.26;
  const optLetter = ['A', 'B', 'C'][lane];

  return {
    lane,
    jumpRequested,
    fingerCount: lane + 1,
    selectedOption: lane,
    gestureLabel: jumpRequested
      ? `Kepala Dongak (LOMPAT!) · Gate ${optLetter}`
      : `Kepala Condong · Gate ${optLetter} (${LANE_LABELS[lane]})`,
    normalizedX: mirroredX,
    normalizedY
  };
}

/**
 * Evaluates a player's gate selection at a Quiz Checkpoint.
 */
export function evaluateQuizGate(
  question: QuizQuestion,
  chosenLane: LaneIndex,
  currentStreak: number
): {
  isCorrect: boolean;
  scoreDelta: number;
  newStreak: number;
  chosenText: string;
  correctText: string;
} {
  const isCorrect = chosenLane === question.correctIndex;
  const newStreak = isCorrect ? currentStreak + 1 : 0;
  const streakBonus = isCorrect ? Math.min(currentStreak * 25, 100) : 0;
  const scoreDelta = isCorrect ? 150 + streakBonus : 0;

  return {
    isCorrect,
    scoreDelta,
    newStreak,
    chosenText: question.options[chosenLane],
    correctText: question.options[question.correctIndex]
  };
}

/**
 * Updates player vitality (0..6 half-hearts, or 3 full hearts with 2 HP per heart:
 * 6 = 3 full hearts, 5 = 2 full + 1 cracked, etc.).
 */
export function updatePlayerVitality(
  currentHp: number,
  deltaHp: number,
  maxHp = 6
): { hp: number; isDefeated: boolean; heartStates: ('full' | 'cracked' | 'empty')[] } {
  const hp = Math.max(0, Math.min(maxHp, currentHp + deltaHp));
  const heartStates: ('full' | 'cracked' | 'empty')[] = [];
  const totalHearts = Math.floor(maxHp / 2);

  for (let i = 0; i < totalHearts; i++) {
    const heartHp = hp - i * 2;
    if (heartHp >= 2) heartStates.push('full');
    else if (heartHp === 1) heartStates.push('cracked');
    else heartStates.push('empty');
  }

  return {
    hp,
    isDefeated: hp <= 0,
    heartStates
  };
}

/**
 * Checks whether each mission item and overall victory condition is satisfied.
 */
export function checkMissionCompletion(progress: MissionProgress): {
  mission1CollectDone: boolean;
  mission2QuizDone: boolean;
  mission3FinishDone: boolean;
  completedCount: number;
  allComplete: boolean;
} {
  const mission1CollectDone = progress.itemsCollected >= progress.targetItems;
  const mission2QuizDone = progress.quizzesCorrect >= Math.min(3, progress.targetQuizzes);
  const mission3FinishDone = progress.reachedFinish;

  const completedCount =
    (mission1CollectDone ? 1 : 0) +
    (mission2QuizDone ? 1 : 0) +
    (mission3FinishDone ? 1 : 0);

  return {
    mission1CollectDone,
    mission2QuizDone,
    mission3FinishDone,
    completedCount,
    allComplete: mission1CollectDone && mission2QuizDone && mission3FinishDone
  };
}

/**
 * Filters questions by game mode ('pustaka' | 'sains' | 'campuran').
 */
export function getQuestionsForMode(mode: 'pustaka' | 'sains' | 'campuran'): QuizQuestion[] {
  if (mode === 'campuran') return QUIZ_QUESTIONS;
  return QUIZ_QUESTIONS.filter((q) => q.topic === mode);
}

/**
 * Formats elapsed seconds into MM:SS tabular string.
 */
export function formatTimeMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

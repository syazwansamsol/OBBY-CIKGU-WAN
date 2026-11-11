import test from 'node:test';
import assert from 'node:assert/strict';
import {
  laneFromNormalizedX,
  interpretHandLandmarks,
  interpretFaceNosePosition,
  evaluateQuizGate,
  updatePlayerVitality,
  checkMissionCompletion,
  formatTimeMMSS,
  Point3D
} from './rules';
import { QUIZ_QUESTIONS } from './quizData';

test('laneFromNormalizedX maps mirrored X into 3 Obby lanes accurately', () => {
  assert.equal(laneFromNormalizedX(0.15), 0); // Kiri (Gate A)
  assert.equal(laneFromNormalizedX(0.5), 1);  // Tengah (Gate B)
  assert.equal(laneFromNormalizedX(0.85), 2); // Kanan (Gate C)
});

test('interpretHandLandmarks detects raised fingers, lane steering, and jump', () => {
  // Build 21 mock landmarks with 2 raised fingers (index & middle) in center lane
  const landmarks: Point3D[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.6 }));
  // Index finger extended (tip 8 higher than PIP 6)
  landmarks[6] = { x: 0.5, y: 0.55 };
  landmarks[8] = { x: 0.5, y: 0.35 };
  // Middle finger extended (tip 12 higher than PIP 10)
  landmarks[10] = { x: 0.5, y: 0.55 };
  landmarks[12] = { x: 0.5, y: 0.35 };
  // Ring & Pinky folded
  landmarks[14] = { x: 0.5, y: 0.55 };
  landmarks[16] = { x: 0.5, y: 0.65 };
  landmarks[18] = { x: 0.5, y: 0.55 };
  landmarks[20] = { x: 0.5, y: 0.65 };

  const res = interpretHandLandmarks(landmarks, true);
  assert.equal(res.lane, 1);
  assert.equal(res.fingerCount, 2);
  assert.equal(res.selectedOption, 1); // 2 fingers -> Option B (index 1)
  assert.equal(res.jumpRequested, false);
});

test('interpretFaceNosePosition maps head tilt and head raise jump', () => {
  // User tilts head to their left (raw camera x = 0.8 -> mirroredX = 0.2 -> Lane 0)
  const leftTilt = interpretFaceNosePosition({ x: 0.8, y: 0.5 }, true);
  assert.equal(leftTilt.lane, 0);
  assert.equal(leftTilt.jumpRequested, false);

  // User raises head high (y = 0.20 -> jumpRequested = true)
  const jumpTilt = interpretFaceNosePosition({ x: 0.5, y: 0.2 }, true);
  assert.equal(jumpTilt.lane, 1);
  assert.equal(jumpTilt.jumpRequested, true);
});

test('evaluateQuizGate rewards correct Kamus Dewan answer with streak bonus', () => {
  const qJinjing = QUIZ_QUESTIONS[0]; // correctIndex: 0 ('jinjing')
  const correctEval = evaluateQuizGate(qJinjing, 0, 2);
  assert.equal(correctEval.isCorrect, true);
  assert.equal(correctEval.newStreak, 3);
  assert.equal(correctEval.scoreDelta, 200); // 150 base + 2*25 streak

  const wrongEval = evaluateQuizGate(qJinjing, 2, 2);
  assert.equal(wrongEval.isCorrect, false);
  assert.equal(wrongEval.newStreak, 0);
  assert.equal(wrongEval.scoreDelta, 0);
});

test('updatePlayerVitality computes 3-state heart sockets (full, cracked, empty)', () => {
  const s1 = updatePlayerVitality(6, -1); // 5 HP -> Full, Full, Cracked
  assert.equal(s1.hp, 5);
  assert.equal(s1.isDefeated, false);
  assert.deepEqual(s1.heartStates, ['full', 'full', 'cracked']);

  const s2 = updatePlayerVitality(1, -2); // 0 HP -> Empty, Empty, Empty
  assert.equal(s2.hp, 0);
  assert.equal(s2.isDefeated, true);
  assert.deepEqual(s2.heartStates, ['empty', 'empty', 'empty']);
});

test('checkMissionCompletion tracks Obby goals and formatTimeMMSS formats tabular clock', () => {
  const status = checkMissionCompletion({
    itemsCollected: 12,
    targetItems: 10,
    quizzesAnswered: 5,
    quizzesCorrect: 4,
    targetQuizzes: 5,
    reachedFinish: true
  });
  assert.equal(status.mission1CollectDone, true);
  assert.equal(status.mission2QuizDone, true);
  assert.equal(status.mission3FinishDone, true);
  assert.equal(status.completedCount, 3);
  assert.equal(status.allComplete, true);
  assert.equal(formatTimeMMSS(65), '01:05');
});

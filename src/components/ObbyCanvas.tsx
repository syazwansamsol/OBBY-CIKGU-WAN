import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LaneIndex, LANE_WORLD_X, evaluateQuizGate } from '../game/rules';
import { QuizQuestion } from '../game/quizData';
import { soundEngine } from '../game/sound';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export interface ActiveQuizBannerState {
  gateIndex: number;
  totalGates: number;
  question: QuizQuestion;
  distanceMeters: number;
}

export interface QuizFeedbackToast {
  isCorrect: boolean;
  word: string;
  explanation: string;
  scoreDelta: number;
}

interface ObbyCanvasProps {
  gameState: GameState;
  targetLane: LaneIndex;
  onLaneChange: (lane: LaneIndex) => void;
  jumpSignal: number;
  directAnswerSignal: { option: 0 | 1 | 2; seq: number } | null;
  questions: QuizQuestion[];
  runId: number;
  onHudUpdate: (hud: {
    score: number;
    hp: number;
    itemsCollected: number;
    quizzesAnswered: number;
    quizzesCorrect: number;
    streak: number;
    elapsedSeconds: number;
    progressPercent: number;
    activeQuiz: ActiveQuizBannerState | null;
  }) => void;
  onQuizFeedback: (toast: QuizFeedbackToast) => void;
  onGameEnd: (result: {
    victory: boolean;
    finalScore: number;
    elapsedSeconds: number;
    itemsCollected: number;
    quizzesCorrect: number;
    totalQuizzes: number;
  }) => void;
}

const GATE_Z_POSITIONS = [-32, -66, -100, -134, -168];
const FINISH_Z = -194;
const PARTICLE_COUNT = 60;

function createFaceCanvasTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(0, 0, 128, 128);

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(44, 52, 9, 0, Math.PI * 2);
  ctx.arc(84, 52, 9, 0, Math.PI * 2);
  ctx.fill();

  // Eye shine
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(41, 49, 3, 0, Math.PI * 2);
  ctx.arc(81, 49, 3, 0, Math.PI * 2);
  ctx.fill();

  // Confident Roblox smile
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(64, 68, 20, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createGateBadgeTexture(letter: string, bgHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 112, 112);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 76px "Fredoka", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 64, 68);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCheckeredTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const size = 32;
  for (let y = 0; y < 64; y += size) {
    for (let x = 0; x < 256; x += size) {
      ctx.fillStyle = ((x + y) / size) % 2 === 0 ? '#0f172a' : '#ffffff';
      ctx.fillRect(x, y, size, size);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export const ObbyCanvas: React.FC<ObbyCanvasProps> = ({
  gameState,
  targetLane,
  onLaneChange,
  jumpSignal,
  directAnswerSignal,
  questions,
  runId,
  onHudUpdate,
  onQuizFeedback,
  onGameEnd
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store mutable props in refs so React HUD updates never tear down the WebGL scene
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const targetLaneRef = useRef<LaneIndex>(targetLane);
  targetLaneRef.current = targetLane;

  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const callbacksRef = useRef({
    onLaneChange,
    onHudUpdate,
    onQuizFeedback,
    onGameEnd
  });
  callbacksRef.current = {
    onLaneChange,
    onHudUpdate,
    onQuizFeedback,
    onGameEnd
  };

  // Internal simulation ref accessible across signal effects
  const simRef = useRef<{
    triggerJump: () => void;
    triggerDirectGateAnswer: (opt: 0 | 1 | 2) => void;
    resetRun: () => void;
  } | null>(null);

  useEffect(() => {
    if (jumpSignal > 0 && simRef.current) {
      simRef.current.triggerJump();
    }
  }, [jumpSignal]);

  useEffect(() => {
    if (directAnswerSignal && simRef.current) {
      simRef.current.triggerDirectGateAnswer(directAnswerSignal.option);
    }
  }, [directAnswerSignal]);

  useEffect(() => {
    if (simRef.current) {
      simRef.current.resetRun();
    }
  }, [runId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect software WebGL (SwiftShader / llvmpipe) per threejs skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Sky Background, Fog & RoomEnvironment
    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x38bdf8);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x38bdf8, 0.0085);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      58,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      260
    );
    camera.position.set(0, 6.2, 10.5);

    // 3. Studio Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.95);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    keyLight.position.set(18, 34, 24);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 120;
      const d = 28;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.7);
    rimLight.position.set(-16, 18, -20);
    scene.add(rimLight);

    // 4. Build the 3-Lane Roblox Obby Track & Island Environment
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Track Deck Base (3 lanes: Left=-3.2, Center=0, Right=+3.2)
    const trackLength = 220;
    const trackGeo = new THREE.BoxGeometry(11.4, 1.2, trackLength);
    const trackMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.15
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(0, -0.6, -98);
    trackMesh.receiveShadow = true;
    worldGroup.add(trackMesh);

    // Tapered floating island rock underside
    const rockUnderGeo = new THREE.ConeGeometry(9.5, 8, 8);
    const rockUnderMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.05
    });
    for (let rz = 0; rz >= -200; rz -= 25) {
      const rockCone = new THREE.Mesh(rockUnderGeo, rockUnderMat);
      rockCone.rotation.x = Math.PI;
      rockCone.position.set(0, -5.0, rz);
      worldGroup.add(rockCone);
    }

    // Colorful Obby stepping tiles along the 3 lanes
    const laneColors = [0x0ea5e9, 0xf59e0b, 0x10b981];
    const padGeo = new THREE.BoxGeometry(2.7, 0.12, 4.2);
    const padMaterials = laneColors.map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.35,
          metalness: 0.2
        })
    );

    for (let z = 4; z >= -196; z -= 5.2) {
      for (let laneIdx = 0; laneIdx < 3; laneIdx++) {
        const pad = new THREE.Mesh(padGeo, padMaterials[laneIdx]);
        pad.position.set(LANE_WORLD_X[laneIdx as LaneIndex], 0.03, z);
        pad.receiveShadow = true;
        worldGroup.add(pad);
      }
    }

    // Green park borders on left & right of track with multi-part Trees & Recycling Bins
    const grassBorderGeo = new THREE.BoxGeometry(4.5, 1.3, trackLength);
    const grassBorderMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.75,
      metalness: 0.05
    });
    const leftGrass = new THREE.Mesh(grassBorderGeo, grassBorderMat);
    leftGrass.position.set(-8.0, -0.5, -98);
    const rightGrass = new THREE.Mesh(grassBorderGeo, grassBorderMat);
    rightGrass.position.set(8.0, -0.5, -98);
    worldGroup.add(leftGrass, rightGrass);

    // Helper: Build 5-part stylized Tree Group
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 1.8, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const leafGeo1 = new THREE.ConeGeometry(1.6, 2.2, 8);
    const leafGeo2 = new THREE.ConeGeometry(1.25, 1.9, 8);
    const leafGeo3 = new THREE.ConeGeometry(0.85, 1.5, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55 });
    const shadowDiscGeo = new THREE.CircleGeometry(1.1, 16);
    const shadowDiscMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });

    for (let tz = 2; tz >= -195; tz -= 14) {
      [-7.8, 7.8].forEach((tx, sideIdx) => {
        const treeGroup = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.9;
        const l1 = new THREE.Mesh(leafGeo1, leafMat);
        l1.position.y = 2.4;
        const l2 = new THREE.Mesh(leafGeo2, leafMat);
        l2.position.y = 3.5;
        const l3 = new THREE.Mesh(leafGeo3, leafMat);
        l3.position.y = 4.4;
        const sDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
        sDisc.rotation.x = -Math.PI / 2;
        sDisc.position.y = 0.18;
        treeGroup.add(trunk, l1, l2, l3, sDisc);
        const s = 0.85 + ((Math.abs(tz) + sideIdx) % 3) * 0.12;
        treeGroup.scale.setScalar(s);
        treeGroup.position.set(tx + (sideIdx === 0 ? -0.4 : 0.4), 0.15, tz);
        worldGroup.add(treeGroup);
      });
    }

    // Helper: Build 4-part Recycling Bins (Green, Orange/Red, Purple like Image 1!)
    const binBodyGeo = new THREE.BoxGeometry(0.95, 1.25, 0.85);
    const binLidGeo = new THREE.BoxGeometry(1.06, 0.18, 0.96);
    const binBadgeGeo = new THREE.BoxGeometry(0.42, 0.42, 0.06);
    const binColors = [0x16a34a, 0xea580c, 0x9333ea];
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });

    for (let bz = -10; bz >= -180; bz -= 34) {
      binColors.forEach((bHex, bIdx) => {
        const binGroup = new THREE.Group();
        const bMat = new THREE.MeshStandardMaterial({ color: bHex, roughness: 0.4, metalness: 0.15 });
        const body = new THREE.Mesh(binBodyGeo, bMat);
        body.position.y = 0.625;
        const lid = new THREE.Mesh(binLidGeo, bMat);
        lid.position.y = 1.32;
        const badge = new THREE.Mesh(binBadgeGeo, whiteMat);
        badge.position.set(0, 0.68, 0.43);
        binGroup.add(body, lid, badge);
        binGroup.position.set(-6.5, 0.15, bz - bIdx * 1.4);
        binGroup.rotation.y = Math.PI / 3;
        worldGroup.add(binGroup);
      });
    }

    // 5. Build the Roblox Hero Protagonist ("Kishan") as a 9-part articulated THREE.Group
    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    const playerShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 20),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      })
    );
    playerShadow.rotation.x = -Math.PI / 2;
    playerShadow.position.y = 0.05;
    playerGroup.add(playerShadow);

    const playerVisualRig = new THREE.Group();
    playerGroup.add(playerVisualRig);

    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45, metalness: 0.1 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6, metalness: 0.1 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.4, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.75, metalness: 0.05 });

    // Torso + iconic rotated white square Roblox Obby emblem on front and back
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.25, 0.58), shirtMat);
    torsoMesh.position.y = 1.55;
    torsoMesh.castShadow = true;
    playerVisualRig.add(torsoMesh);

    const logoOuterGeo = new THREE.BoxGeometry(0.42, 0.42, 0.62);
    const logoInnerGeo = new THREE.BoxGeometry(0.18, 0.18, 0.65);
    const logoOuter = new THREE.Mesh(logoOuterGeo, whiteMat);
    logoOuter.position.y = 1.58;
    logoOuter.rotation.z = -0.22;
    const logoInner = new THREE.Mesh(logoInnerGeo, shirtMat);
    logoInner.position.y = 1.58;
    logoInner.rotation.z = -0.22;
    playerVisualRig.add(logoOuter, logoInner);

    // Head with face texture on front (+Z) and back/sides skin
    const faceTex = createFaceCanvasTexture(maxAnisotropy);
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, color: 0xffffff, roughness: 0.35 });
    const headMaterials = [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat];
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.78), headMaterials);
    headMesh.position.y = 2.62;
    headMesh.castShadow = true;
    playerVisualRig.add(headMesh);

    // Spiky Roblox Hair Group (5 parts)
    const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.28, 0.86), hairMat);
    hairCap.position.y = 2.98;
    playerVisualRig.add(hairCap);
    for (let sIdx = -1; sIdx <= 1; sIdx++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 5), hairMat);
      spike.position.set(sIdx * 0.25, 3.22, 0.08);
      spike.rotation.z = -sIdx * 0.25;
      playerVisualRig.add(spike);
    }

    // Articulated Arms & Legs
    const makeArm = (xOffset: number) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(xOffset, 2.08, 0);
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.4), shirtMat);
      sleeve.position.y = -0.22;
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.36), skinMat);
      hand.position.y = -0.72;
      armPivot.add(sleeve, hand);
      playerVisualRig.add(armPivot);
      return armPivot;
    };

    const makeLeg = (xOffset: number) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(xOffset, 0.95, 0);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.78, 0.48), pantsMat);
      legMesh.position.y = -0.38;
      const shoeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.56), whiteMat);
      shoeMesh.position.set(0, -0.84, 0.04);
      legPivot.add(legMesh, shoeMesh);
      playerVisualRig.add(legPivot);
      return legPivot;
    };

    const leftArm = makeArm(-0.78);
    const rightArm = makeArm(0.78);
    const leftLeg = makeLeg(-0.3);
    const rightLeg = makeLeg(0.3);

    // 6. Collectible Kamus Books & Golden Knowledge Coins + Low Jump Hurdles
    interface CollectibleItem {
      mesh: THREE.Group;
      lane: LaneIndex;
      z: number;
      collected: boolean;
      type: 'book' | 'coin';
    }

    interface HurdleObstacle {
      mesh: THREE.Group;
      lane: LaneIndex;
      z: number;
      hitTriggered: boolean;
    }

    const collectibles: CollectibleItem[] = [];
    const hurdles: HurdleObstacle[] = [];

    const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.16, 18);
    const coinInnerGeo = new THREE.BoxGeometry(0.38, 0.38, 0.22);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.2,
      metalness: 0.85,
      emissive: 0xca8a04,
      emissiveIntensity: 0.25
    });

    const bookCoverGeo = new THREE.BoxGeometry(0.76, 0.96, 0.22);
    const bookPagesGeo = new THREE.BoxGeometry(0.68, 0.88, 0.26);
    const bookCoverMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.35,
      metalness: 0.2
    });

    // Place 18 collectibles along the course (avoiding gate Zs)
    const itemZList = [
      -10, -16, -23, -40, -47, -54, -74, -81, -88,
      -108, -115, -122, -142, -149, -156, -175, -181, -186
    ];

    itemZList.forEach((iz, idx) => {
      const lane = (idx % 3) as LaneIndex;
      const isBook = idx % 2 === 0;
      const g = new THREE.Group();

      if (isBook) {
        const cover = new THREE.Mesh(bookCoverGeo, bookCoverMat);
        const pages = new THREE.Mesh(bookPagesGeo, whiteMat);
        pages.position.x = 0.04;
        g.add(cover, pages);
      } else {
        const disk = new THREE.Mesh(coinGeo, coinMat);
        disk.rotation.x = Math.PI / 2;
        const star = new THREE.Mesh(coinInnerGeo, whiteMat);
        g.add(disk, star);
      }

      g.position.set(LANE_WORLD_X[lane], 1.35, iz);
      worldGroup.add(g);
      collectibles.push({
        mesh: g,
        lane,
        z: iz,
        collected: false,
        type: isBook ? 'book' : 'coin'
      });
    });

    // Place 6 jumpable low hurdles along the course with clear yellow/red warning bars
    const hurdleSpecs: { z: number; lane: LaneIndex }[] = [
      { z: -19.5, lane: 1 },
      { z: -50.5, lane: 0 },
      { z: -84.5, lane: 2 },
      { z: -118.5, lane: 1 },
      { z: -152.5, lane: 0 },
      { z: -178.5, lane: 1 }
    ];

    const hurdleBarGeo = new THREE.BoxGeometry(2.4, 0.38, 0.38);
    const hurdlePostGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.0, 8);
    const hurdleMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0xbe123c,
      emissiveIntensity: 0.35
    });
    const postMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });

    hurdleSpecs.forEach((hSpec) => {
      const hg = new THREE.Group();
      const bar = new THREE.Mesh(hurdleBarGeo, hurdleMat);
      bar.position.y = 0.65;
      const pLeft = new THREE.Mesh(hurdlePostGeo, postMat);
      pLeft.position.set(-1.1, 0.5, 0);
      const pRight = new THREE.Mesh(hurdlePostGeo, postMat);
      pRight.position.set(1.1, 0.5, 0);
      hg.add(bar, pLeft, pRight);
      hg.position.set(LANE_WORLD_X[hSpec.lane], 0.05, hSpec.z);
      worldGroup.add(hg);
      hurdles.push({
        mesh: hg,
        lane: hSpec.lane,
        z: hSpec.z,
        hitTriggered: false
      });
    });

    // 7. Build the 5 Glowing 3D Quiz Archways (Gate A, Gate B, Gate C)
    const gateBadgeTextures = [
      createGateBadgeTexture('A', '#38bdf8', maxAnisotropy),
      createGateBadgeTexture('B', '#fbbf24', maxAnisotropy),
      createGateBadgeTexture('C', '#34d399', maxAnisotropy)
    ];

    const archPillarGeo = new THREE.BoxGeometry(0.45, 5.2, 0.45);
    const archTopGeo = new THREE.BoxGeometry(11.4, 0.75, 0.65);
    const archPurpleMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      roughness: 0.25,
      metalness: 0.3,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.45
    });

    const portalFrameColors = [0x0ea5e9, 0xf59e0b, 0x10b981];
    const badgeGeo = new THREE.BoxGeometry(1.35, 1.35, 0.22);

    const gateMeshes: THREE.Group[] = [];

    GATE_Z_POSITIONS.forEach((gz) => {
      const archGroup = new THREE.Group();
      archGroup.position.set(0, 0, gz);

      // Outer purple checkpoint pillars & lintel
      const leftPillar = new THREE.Mesh(archPillarGeo, archPurpleMat);
      leftPillar.position.set(-5.3, 2.6, 0);
      const rightPillar = new THREE.Mesh(archPillarGeo, archPurpleMat);
      rightPillar.position.set(5.3, 2.6, 0);
      const topBeam = new THREE.Mesh(archTopGeo, archPurpleMat);
      topBeam.position.set(0, 5.3, 0);
      archGroup.add(leftPillar, rightPillar, topBeam);

      // 3 Lane Portals (A, B, C)
      for (let lIdx = 0; lIdx < 3; lIdx++) {
        const lx = LANE_WORLD_X[lIdx as LaneIndex];
        const portalMat = new THREE.MeshStandardMaterial({
          color: portalFrameColors[lIdx],
          transparent: true,
          opacity: 0.32,
          roughness: 0.2,
          depthWrite: false
        });
        const curtain = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.8, 0.14), portalMat);
        curtain.position.set(lx, 1.95, 0);

        const badgeMat = new THREE.MeshStandardMaterial({
          map: gateBadgeTextures[lIdx],
          color: 0xffffff,
          roughness: 0.3
        });
        const badge = new THREE.Mesh(badgeGeo, badgeMat);
        badge.position.set(lx, 4.15, 0.2);

        archGroup.add(curtain, badge);
      }

      worldGroup.add(archGroup);
      gateMeshes.push(archGroup);
    });

    // 8. Build the Garisan Penamat (Checkered Arch + Giant Golden Trophy at FINISH_Z)
    const finishGroup = new THREE.Group();
    finishGroup.position.set(0, 0, FINISH_Z);

    const checkeredTex = createCheckeredTexture(maxAnisotropy);
    const checkeredMat = new THREE.MeshStandardMaterial({
      map: checkeredTex,
      color: 0xffffff,
      roughness: 0.4
    });
    const finishBanner = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.4, 0.45), checkeredMat);
    finishBanner.position.set(0, 5.2, 0);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.18,
      metalness: 0.9,
      emissive: 0xca8a04,
      emissiveIntensity: 0.2
    });
    const fLeftPost = new THREE.Mesh(archPillarGeo, goldMat);
    fLeftPost.position.set(-5.3, 2.6, 0);
    const fRightPost = new THREE.Mesh(archPillarGeo, goldMat);
    fRightPost.position.set(5.3, 2.6, 0);

    // 5-part Golden Trophy centerpiece
    const trophyGroup = new THREE.Group();
    trophyGroup.position.set(0, 0.2, -2.5);
    const tBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 16), goldMat);
    tBase.position.y = 0.25;
    const tStem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 1.2, 12), goldMat);
    tStem.position.y = 1.05;
    const tCup = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.65, 1.6, 16), goldMat);
    tCup.position.y = 2.35;
    trophyGroup.add(tBase, tStem, tCup);

    finishGroup.add(finishBanner, fLeftPost, fRightPost, trophyGroup);
    worldGroup.add(finishGroup);

    // 9. Pooled InstancedMesh Particle Ring Buffer (Zero-GC)
    const particleGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_COUNT);
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleVelocities = new Float32Array(PARTICLE_COUNT * 3);
    const particleLifetimes = new Float32Array(PARTICLE_COUNT);
    let particleCursor = 0;
    const _dummyMatrix = new THREE.Matrix4();
    const _dummyColor = new THREE.Color();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      _dummyMatrix.makeScale(0, 0, 0);
      particleInstanced.setMatrixAt(i, _dummyMatrix);
    }
    particleInstanced.instanceMatrix.needsUpdate = true;

    const spawnParticleBurst = (wx: number, wy: number, wz: number, hexColor: number, count = 18) => {
      _dummyColor.setHex(hexColor);
      for (let i = 0; i < count; i++) {
        const idx = particleCursor % PARTICLE_COUNT;
        particleCursor++;
        particlePositions[idx * 3 + 0] = wx + (Math.random() - 0.5) * 0.8;
        particlePositions[idx * 3 + 1] = wy + (Math.random() - 0.5) * 0.6;
        particlePositions[idx * 3 + 2] = wz + (Math.random() - 0.5) * 0.8;

        particleVelocities[idx * 3 + 0] = (Math.random() - 0.5) * 8.5;
        particleVelocities[idx * 3 + 1] = 3.5 + Math.random() * 6.5;
        particleVelocities[idx * 3 + 2] = (Math.random() - 0.5) * 8.5;
        particleLifetimes[idx] = 0.55 + Math.random() * 0.35;
        particleInstanced.setColorAt(idx, _dummyColor);
      }
      if (particleInstanced.instanceColor) {
        particleInstanced.instanceColor.needsUpdate = true;
      }
    };

    // 10. Game Simulation State
    let playerX = 0;
    let playerY = 0;
    let playerZ = 2;
    let playerVy = 0;
    let scaleX = 1;
    let scaleY = 1;
    let walkPhase = 0;
    let hitstopTimer = 0;
    let shakeTrauma = 0;

    let score = 0;
    let hp = 6; // 3 full hearts
    let itemsCollected = 0;
    let quizzesAnswered = 0;
    let quizzesCorrect = 0;
    let streak = 0;
    let elapsedSeconds = 0;
    let nextGateIdx = 0;
    let lastHudSyncTime = 0;
    let runEnded = false;

    const resetSimulation = () => {
      playerX = 0;
      playerY = 0;
      playerZ = 2;
      playerVy = 0;
      scaleX = 1;
      scaleY = 1;
      walkPhase = 0;
      hitstopTimer = 0;
      shakeTrauma = 0;

      score = 0;
      hp = 6;
      itemsCollected = 0;
      quizzesAnswered = 0;
      quizzesCorrect = 0;
      streak = 0;
      elapsedSeconds = 0;
      nextGateIdx = 0;
      runEnded = false;

      collectibles.forEach((c) => {
        c.collected = false;
        c.mesh.visible = true;
      });
      hurdles.forEach((h) => {
        h.hitTriggered = false;
      });
      gateMeshes.forEach((gm) => {
        gm.visible = true;
      });
    };

    const triggerJump = () => {
      if (gameStateRef.current !== 'playing') return;
      if (playerY <= 0.12) {
        playerVy = 10.6;
        scaleX = 0.84;
        scaleY = 1.2;
        soundEngine.playJump();
        spawnParticleBurst(playerX, 0.2, playerZ, 0xfef08a, 8);
      }
    };

    const resolveGateIndex = (gIdx: number, chosenLane: LaneIndex) => {
      const qList = questionsRef.current;
      const question = qList[gIdx % qList.length];
      const evaluation = evaluateQuizGate(question, chosenLane, streak);

      quizzesAnswered++;
      streak = evaluation.newStreak;

      if (evaluation.isCorrect) {
        quizzesCorrect++;
        score += evaluation.scoreDelta;
        hitstopTimer = 0.045;
        soundEngine.playQuizCorrect();
        spawnParticleBurst(LANE_WORLD_X[chosenLane], 2.2, GATE_Z_POSITIONS[gIdx], 0x34d399, 24);
      } else {
        hp = Math.max(0, hp - 1);
        hitstopTimer = 0.06;
        shakeTrauma = 0.65;
        soundEngine.playHurtOrWrong();
        spawnParticleBurst(LANE_WORLD_X[chosenLane], 2.2, GATE_Z_POSITIONS[gIdx], 0xf43f5e, 20);
      }

      callbacksRef.current.onQuizFeedback({
        isCorrect: evaluation.isCorrect,
        word: question.wordFocus,
        explanation: question.explanation,
        scoreDelta: evaluation.scoreDelta
      });

      if (gateMeshes[gIdx]) {
        gateMeshes[gIdx].visible = false;
      }
      nextGateIdx = gIdx + 1;

      if (hp <= 0 && !runEnded) {
        runEnded = true;
        callbacksRef.current.onGameEnd({
          victory: false,
          finalScore: score,
          elapsedSeconds,
          itemsCollected,
          quizzesCorrect,
          totalQuizzes: GATE_Z_POSITIONS.length
        });
      }
    };

    const triggerDirectGateAnswer = (option: 0 | 1 | 2) => {
      if (gameStateRef.current !== 'playing' || runEnded) return;
      callbacksRef.current.onLaneChange(option);
      targetLaneRef.current = option;
      if (nextGateIdx < GATE_Z_POSITIONS.length) {
        const gz = GATE_Z_POSITIONS[nextGateIdx];
        const dist = playerZ - gz;
        // Allow answering the upcoming gate from anywhere in the current segment
        if (dist <= 40 && dist >= -2) {
          playerX = LANE_WORLD_X[option];
          playerZ = gz - 1.2;
          resolveGateIndex(nextGateIdx, option);
        }
      }
    };

    simRef.current = {
      triggerJump,
      triggerDirectGateAnswer,
      resetRun: resetSimulation
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Emit initial HUD state immediately so activeQuiz is visible on frame 0
    if (questionsRef.current.length > 0) {
      callbacksRef.current.onHudUpdate({
        score: 0,
        hp: 6,
        itemsCollected: 0,
        quizzesAnswered: 0,
        quizzesCorrect: 0,
        streak: 0,
        elapsedSeconds: 0,
        progressPercent: 0,
        activeQuiz: {
          gateIndex: 1,
          totalGates: GATE_Z_POSITIONS.length,
          question: questionsRef.current[0],
          distanceMeters: Math.round(2 - GATE_Z_POSITIONS[0])
        }
      });
    }

    // 11. Frame-Rate Independent Animation Loop with Software-WebGL `afterDraw` Pacing
    let frameId = 0;
    let lastTimestamp = performance.now();
    const _lookTarget = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const now = performance.now();
      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const currentState = gameStateRef.current;

      // Update pooled particles in real dt
      let anyParticleActive = false;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (particleLifetimes[i] > 0) {
          anyParticleActive = true;
          particleLifetimes[i] -= dt;
          if (particleLifetimes[i] <= 0) {
            _dummyMatrix.makeScale(0, 0, 0);
            particleInstanced.setMatrixAt(i, _dummyMatrix);
          } else {
            particlePositions[i * 3 + 0] += particleVelocities[i * 3 + 0] * dt;
            particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * dt;
            particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * dt;
            particleVelocities[i * 3 + 1] -= 15.0 * dt; // Gravity
            const s = Math.min(1, particleLifetimes[i] * 2.5);
            _dummyMatrix.makeTranslation(
              particlePositions[i * 3 + 0],
              particlePositions[i * 3 + 1],
              particlePositions[i * 3 + 2]
            );
            _dummyMatrix.scale(_lookTarget.set(s, s, s));
            particleInstanced.setMatrixAt(i, _dummyMatrix);
          }
        }
      }
      if (anyParticleActive) {
        particleInstanced.instanceMatrix.needsUpdate = true;
      }

      // Rotate collectibles & finish trophy
      const spinAngle = now * 0.0025;
      collectibles.forEach((c) => {
        if (!c.collected) {
          c.mesh.rotation.y = spinAngle;
        }
      });
      trophyGroup.rotation.y = spinAngle * 0.8;

      if (currentState === 'title') {
        // Diegetic In-World Awakening stage: Character idles facing camera at start
        playerGroup.position.set(0, 0, 2);
        playerVisualRig.rotation.y = THREE.MathUtils.damp(playerVisualRig.rotation.y, 0, 8, dt);
        leftArm.rotation.x = Math.sin(now * 0.003) * 0.18;
        rightArm.rotation.x = -Math.sin(now * 0.003) * 0.18;
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;

        const camAngle = Math.sin(now * 0.00045) * 0.45;
        camera.position.set(Math.sin(camAngle) * 7.5, 5.2, 8.8);
        _lookTarget.set(0, 2.2, -12);
        camera.lookAt(_lookTarget);
      } else if (currentState === 'playing' && !runEnded) {
        elapsedSeconds += dt;

        if (hitstopTimer > 0) {
          hitstopTimer -= dt;
        } else {
          // Determine forward speed (slow gently when approaching a Quiz Gate so player can read & gesture)
          let forwardSpeed = 9.5;
          if (nextGateIdx < GATE_Z_POSITIONS.length) {
            const distToGate = playerZ - GATE_Z_POSITIONS[nextGateIdx];
            if (distToGate > 0 && distToGate < 26) {
              forwardSpeed = 5.2;
            }
          }

          playerZ -= forwardSpeed * dt;

          // Smooth lateral damping toward target lane X & face forward (-Z -> Math.PI) with slight yaw into turn
          const desiredX = LANE_WORLD_X[targetLaneRef.current];
          const dx = desiredX - playerX;
          playerX = THREE.MathUtils.damp(playerX, desiredX, 12, dt);
          const targetYaw = Math.PI - THREE.MathUtils.clamp(dx * 0.18, -0.35, 0.35);
          playerVisualRig.rotation.y = THREE.MathUtils.damp(playerVisualRig.rotation.y, targetYaw, 12, dt);

          // Vertical jump physics
          if (playerY > 0 || playerVy > 0) {
            playerY += playerVy * dt;
            playerVy -= 26.0 * dt;
            if (playerY <= 0) {
              playerY = 0;
              playerVy = 0;
              scaleX = 1.2;
              scaleY = 0.82;
            }
          }

          // Recover squash & stretch
          scaleX = THREE.MathUtils.damp(scaleX, 1, 14, dt);
          scaleY = THREE.MathUtils.damp(scaleY, 1, 14, dt);
          playerVisualRig.scale.set(scaleX, scaleY, scaleX);

          // Gait-synced arm and leg swing
          walkPhase += forwardSpeed * dt * 1.45;
          const limbSwing = playerY > 0.1 ? 0.65 : Math.sin(walkPhase) * 0.65;
          leftArm.rotation.x = limbSwing;
          rightArm.rotation.x = -limbSwing;
          leftLeg.rotation.x = -limbSwing;
          rightLeg.rotation.x = limbSwing;

          playerGroup.position.set(playerX, 0, playerZ);
          playerVisualRig.position.y = playerY;
          const shadowScale = Math.max(0.45, 1 - playerY * 0.18);
          playerShadow.scale.setScalar(shadowScale);

          // Check Collectible Pickups
          for (let i = 0; i < collectibles.length; i++) {
            const item = collectibles[i];
            if (!item.collected && Math.abs(playerZ - item.z) < 1.35) {
              const itemX = LANE_WORLD_X[item.lane];
              if (Math.abs(playerX - itemX) < 1.25) {
                item.collected = true;
                item.mesh.visible = false;
                itemsCollected++;
                score += 50;
                soundEngine.playPickup();
                spawnParticleBurst(itemX, 1.4, item.z, 0xfacc15, 12);
              }
            }
          }

          // Check Low Hurdle Obstacles
          for (let i = 0; i < hurdles.length; i++) {
            const h = hurdles[i];
            if (!h.hitTriggered && Math.abs(playerZ - h.z) < 0.85) {
              const hx = LANE_WORLD_X[h.lane];
              if (Math.abs(playerX - hx) < 1.15 && playerY < 0.85) {
                h.hitTriggered = true;
                hp = Math.max(0, hp - 1);
                streak = 0;
                hitstopTimer = 0.055;
                shakeTrauma = 0.7;
                soundEngine.playHurtOrWrong();
                spawnParticleBurst(hx, 0.8, h.z, 0xf43f5e, 16);
                if (hp <= 0 && !runEnded) {
                  runEnded = true;
                  callbacksRef.current.onGameEnd({
                    victory: false,
                    finalScore: score,
                    elapsedSeconds,
                    itemsCollected,
                    quizzesCorrect,
                    totalQuizzes: GATE_Z_POSITIONS.length
                  });
                }
              }
            }
          }

          // Check Quiz Gate Crossing
          if (nextGateIdx < GATE_Z_POSITIONS.length) {
            const gz = GATE_Z_POSITIONS[nextGateIdx];
            if (playerZ <= gz) {
              // Determine which lane player is closest to
              let chosenLane: LaneIndex = 1;
              if (playerX < -1.4) chosenLane = 0;
              else if (playerX > 1.4) chosenLane = 2;
              resolveGateIndex(nextGateIdx, chosenLane);
            }
          }

          // Check Finish Line Crossing
          if (playerZ <= FINISH_Z && !runEnded) {
            runEnded = true;
            score += 300; // Finish bonus
            soundEngine.playVictoryFanfare();
            spawnParticleBurst(0, 2.5, FINISH_Z, 0xfacc15, 36);
            callbacksRef.current.onGameEnd({
              victory: true,
              finalScore: score,
              elapsedSeconds,
              itemsCollected,
              quizzesCorrect,
              totalQuizzes: GATE_Z_POSITIONS.length
            });
          }
        }

        // Camera Follow with exponential damping & trauma shake
        shakeTrauma = Math.max(0, shakeTrauma - dt * 2.2);
        const shakeAmt = shakeTrauma * shakeTrauma * 0.45;
        const shakeX = (Math.random() - 0.5) * shakeAmt;
        const shakeY = (Math.random() - 0.5) * shakeAmt;

        camera.position.x = THREE.MathUtils.damp(camera.position.x, playerX * 0.55 + shakeX, 8, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 5.4 + playerY * 0.3 + shakeY, 8, dt);
        camera.position.z = playerZ + 8.6;

        _lookTarget.set(playerX * 0.35, 2.1 + playerY * 0.2, playerZ - 10);
        camera.lookAt(_lookTarget);
        keyLight.position.set(playerX + 16, 34, playerZ + 20);
        keyLight.target.position.set(playerX, 0, playerZ - 10);
        keyLight.target.updateMatrixWorld();

        // Throttle React HUD updates to ~10Hz
        if (now - lastHudSyncTime > 95) {
          lastHudSyncTime = now;
          let activeQuiz: ActiveQuizBannerState | null = null;
          if (nextGateIdx < GATE_Z_POSITIONS.length) {
            const dist = playerZ - GATE_Z_POSITIONS[nextGateIdx];
            if (dist >= -1) {
              const qList = questionsRef.current;
              activeQuiz = {
                gateIndex: nextGateIdx + 1,
                totalGates: GATE_Z_POSITIONS.length,
                question: qList[nextGateIdx % qList.length],
                distanceMeters: Math.max(0, Math.round(dist))
              };
            }
          }
          const progressPercent = Math.min(
            100,
            Math.max(0, Math.round(((2 - playerZ) / (2 - FINISH_Z)) * 100))
          );

          callbacksRef.current.onHudUpdate({
            score,
            hp,
            itemsCollected,
            quizzesAnswered,
            quizzesCorrect,
            streak,
            elapsedSeconds,
            progressPercent,
            activeQuiz
          });
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="obby-webgl-canvas"
      className="fixed inset-0 w-full h-full z-0 overflow-hidden"
    />
  );
};

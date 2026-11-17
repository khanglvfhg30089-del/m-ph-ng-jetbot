/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ModelVariant, RenderShaderStyle } from '../../types/jetbot';
import { computeJetBotExplodedOffsets } from '../../utils/robotics';

export interface JetBotBuildOptions {
  isSoftwareGl?: boolean;
  maxAnisotropy?: number;
}

export interface JetBotModelRefs {
  rootGroup: THREE.Group;
  leftWheel: THREE.Group;
  rightWheel: THREE.Group;
  lidarTurret: THREE.Group;
  dimensionBoxGroup: THREE.Group;
  stereoCameraGroup: THREE.Group;
  subGroups: {
    chassis: THREE.Group;
    wheels: THREE.Group;
    motorBoard: THREE.Group;
    jetsonNano: THREE.Group;
    ports: THREE.Group;
    topDeck: THREE.Group;
    lidar: THREE.Group;
    camera: THREE.Group;
    antennas: THREE.Group;
    stereoCamera: THREE.Group;
  };
  setExplodeProgress: (progress: number) => void;
  getExplodeProgress: () => number;
  setHighlightedPart: (partId: string | null) => void;
  updateWheelRotations: (leftDelta: number, rightDelta: number) => void;
  updateLidarRotation: (deltaRad: number) => void;
  setRenderStyle: (style: RenderShaderStyle) => void;
  setChassisColor: (colorHex: number) => void;
  setPartVisibility: (partId: string, visible: boolean) => void;
  setDimensionsVisible: (visible: boolean) => void;
  setVariant: (variant: ModelVariant) => void;
  getMeshStats: () => { vertices: number; triangles: number; meshes: number };
  isolatePart: (partId: string | null, mode: 'solo' | 'ghost' | 'none') => void;
  getPartBounding: (partId: string) => { center: THREE.Vector3; size: THREE.Vector3; radius: number } | null;
  setHeadlights: (enabled: boolean) => void;
  setLaserBeamVisible: (enabled: boolean) => void;
  updateMotionDynamics: (linearVel: number, angularVel: number, isBraking: boolean, turnDir: number, dt: number) => void;
  updateAutonomyVisuals: (params: {
    mode: 'manual' | 'obstacle_avoidance' | 'line_follower';
    steerAngle: number;
    targetGapDeg?: number;
    lineError?: number;
    lineDetected?: boolean;
    isObstacleStop?: boolean;
  }) => void;
}

/**
 * Deterministic pseudo-random helper for consistent procedural textures.
 */
function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Procedural micro-grain anodized metal bump + roughness maps.
 */
function createAnodizedMetalMaps(anisotropy: number) {
  const size = 256;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const bImg = bCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const brushBias = (seededNoise(y * 1.7) - 0.5) * 14;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const grain = (seededNoise(x * 13.3 + y * 97.1) - 0.5) * 26;
      const bVal = Math.max(0, Math.min(255, 128 + brushBias + grain));
      const rVal = Math.max(0, Math.min(255, 195 + grain * 0.8));
      bImg.data[idx] = bVal;
      bImg.data[idx + 1] = bVal;
      bImg.data[idx + 2] = bVal;
      bImg.data[idx + 3] = 255;

      rImg.data[idx] = rVal;
      rImg.data[idx + 1] = rVal;
      rImg.data[idx + 2] = rVal;
      rImg.data[idx + 3] = 255;
    }
  }

  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 6);
  bumpMap.anisotropy = anisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(6, 6);
  roughnessMap.anisotropy = anisotropy;

  return { bumpMap, roughnessMap };
}

/**
 * Procedural knobby off-road rubber tire tread maps (albedo + bump + roughness)
 * modeled closely after the real JetBot wheels in lab photos.
 */
function createTireTreadMaps(anisotropy: number) {
  const w = 1024;
  const h = 256;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base dark vulcanized rubber
  cCtx.fillStyle = '#181a1f';
  cCtx.fillRect(0, 0, w, h);

  // Recessed tread valley height
  bCtx.fillStyle = '#242424';
  bCtx.fillRect(0, 0, w, h);

  // Subtle rubber speckle
  for (let i = 0; i < 3200; i++) {
    const x = seededNoise(i * 3.1) * w;
    const y = seededNoise(i * 7.3) * h;
    const shade = Math.floor(20 + seededNoise(i * 11.7) * 18);
    cCtx.fillStyle = `rgb(${shade},${shade},${shade + 2})`;
    cCtx.fillRect(x, y, 2, 2);
  }

  // Aggressive knobby multi-row tread blocks in center band (V = 0.22..0.78 of Lathe UV)
  const stepX = 32;
  const yTop = h * 0.24;
  const yBot = h * 0.76;
  const yMid = h * 0.5;

  for (let col = 0; col < w / stepX; col++) {
    const x = col * stepX;
    const stagger = (col % 2) * 8;

    // Outer shoulder lugs (top & bottom)
    [yTop + 4, yBot - 24].forEach((yLug, rowIdx) => {
      cCtx.fillStyle = '#22252b';
      bCtx.fillStyle = '#e8e8e8';
      const skew = rowIdx === 0 ? 5 : -5;

      cCtx.beginPath();
      cCtx.moveTo(x + 3, yLug);
      cCtx.lineTo(x + stepX - 6, yLug);
      cCtx.lineTo(x + stepX - 6 + skew, yLug + 20);
      cCtx.lineTo(x + 3 + skew, yLug + 20);
      cCtx.closePath();
      cCtx.fill();

      bCtx.beginPath();
      bCtx.moveTo(x + 3, yLug);
      bCtx.lineTo(x + stepX - 6, yLug);
      bCtx.lineTo(x + stepX - 6 + skew, yLug + 20);
      bCtx.lineTo(x + 3 + skew, yLug + 20);
      bCtx.closePath();
      bCtx.fill();
    });

    // Center interlocking herringbone blocks
    cCtx.fillStyle = '#24282f';
    bCtx.fillStyle = '#f5f5f5';
    cCtx.fillRect(x + 5, yMid - 20 + stagger * 0.4, stepX - 11, 14);
    bCtx.fillRect(x + 5, yMid - 20 + stagger * 0.4, stepX - 11, 14);

    cCtx.fillRect(x + 9, yMid + 4 - stagger * 0.4, stepX - 11, 14);
    bCtx.fillRect(x + 9, yMid + 4 - stagger * 0.4, stepX - 11, 14);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.anisotropy = anisotropy;

  return { map, bumpMap };
}

/**
 * High-contrast dark solder-mask PCB CanvasTexture for Jetson & Waveshare boards.
 * NOTE: Bind with material `color: 0xffffff` so colors are never darkened!
 */
function createPcbTexture(boardType: 'jetson' | 'waveshare', anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Matte black-charcoal solder mask (authentic Jetson B01 & Waveshare PCB)
  ctx.fillStyle = boardType === 'jetson' ? '#131820' : '#11161f';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle fiberglass weave & dark copper pours
  ctx.fillStyle = '#18202c';
  ctx.fillRect(24, 24, 464, 464);

  // Fine copper signal traces under dark mask
  ctx.strokeStyle = '#253244';
  ctx.lineWidth = 1.6;
  for (let i = 28; i < 484; i += 18) {
    ctx.beginPath();
    ctx.moveTo(i, 20);
    ctx.lineTo(i + 12, 54);
    ctx.lineTo(i + 12, 460);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(20, i);
    ctx.lineTo(54, i + 12);
    ctx.lineTo(460, i + 12);
    ctx.stroke();
  }

  // Gold ENIG pads & vias
  ctx.fillStyle = '#d4a13e';
  for (let x = 44; x < 480; x += 36) {
    for (let y = 44; y < 480; y += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Corner mounting hole copper rings
  const corners = [
    [32, 32],
    [480, 32],
    [32, 480],
    [480, 480],
  ];
  corners.forEach(([cx, cy]) => {
    ctx.strokeStyle = '#e5b84b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Silkscreen SMD outlines & crisp labels
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(16, 16, 480, 480);

  ctx.fillStyle = '#e2e8f0';
  if (boardType === 'jetson') {
    ctx.font = 'bold 20px monospace';
    ctx.fillText('NVIDIA JETSON NANO', 42, 438);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('P3449-B01  •  128-CORE MAXWELL', 42, 462);
    ctx.fillText('J41 40-PIN GPIO', 340, 62);
    ctx.fillText('CAM0 MIPI-CSI', 350, 462);
  } else {
    ctx.font = 'bold 19px monospace';
    ctx.fillText('WAVESHARE JETBOT', 42, 438);
    ctx.font = '13px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PCA9685 + TB6612FNG + 3S BMS', 42, 462);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('ON  OFF', 38, 42);
    ctx.fillText('BOOT  RST', 350, 42);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/**
 * 0.91" 128x32 OLED telemetry screen mounted on Waveshare expansion board.
 */
function createOledDisplayTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, 256, 64);

  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, 250, 58);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('IP: 192.168.1.42', 14, 24);
  ctx.fillStyle = '#a5f3fc';
  ctx.font = '14px monospace';
  ctx.fillText('BAT:12.4V 88%  CPU:46C', 14, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

/**
 * Top cap texture for RPLIDAR A1 turret ("RPLIDAR" recessed ring + 3 screw recesses).
 */
function createRplidarCapTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#181a1f';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Center recessed medallion circle
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 108, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0f1217';
  ctx.beginPath();
  ctx.arc(cx, cy, 104, 0, Math.PI * 2);
  ctx.fill();

  // Molded "RPLIDAR" lettering matching anh1 & anh2 (high legibility without glare)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RPLIDAR', 0, 0);
  ctx.restore();

  // 3 countersunk screw holes at 120° spacing
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
    const sx = cx + Math.cos(a) * 188;
    const sy = cy + Math.sin(a) * 188;
    ctx.fillStyle = '#07080a';
    ctx.beginPath();
    ctx.arc(sx, sy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d323b';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

/**
 * 15-pin FFC CSI Ribbon Cable CanvasTexture with "AWM 20706 105C 60V VW-1" markings
 * and blue stiffener tabs at both ends (matches anh2 & anh7).
 */
function createFfcRibbonTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // White matte polyester insulation film
  ctx.fillStyle = '#f3f5f8';
  ctx.fillRect(0, 0, 128, 1024);

  // Subtle 15 parallel silver-tin conductor lines visible through film
  ctx.strokeStyle = '#dbe2ea';
  ctx.lineWidth = 2;
  for (let i = 0; i < 15; i++) {
    const x = 10 + (i * 108) / 14;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }

  // Printed green-grey AWM 20706 spec text rotated along ribbon length
  ctx.save();
  ctx.fillStyle = '#3b6a4f';
  ctx.font = 'bold 12px monospace';
  for (let y = 130; y < 920; y += 160) {
    ctx.save();
    ctx.translate(44, y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('AWM 20706 105C 60V VW-1', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(94, y + 65);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('AWM 20706 105C 60V VW-1', 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // Blue PET reinforcing stiffener tabs at camera & Jetson ends
  ctx.fillStyle = '#1d6ce0';
  ctx.fillRect(0, 0, 128, 48);
  ctx.fillRect(0, 976, 128, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

/**
 * Builds a clean rectangular flat ribbon mesh along a 3D spline with proper UVs & surface normals.
 */
function createFlatRibbonGeometry(curve: THREE.Curve<THREE.Vector3>, width: number, segments: number): THREE.BufferGeometry {
  const points = curve.getPoints(segments);
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    tangents.push(curve.getTangent(i / segments).normalize());
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const sideVec = new THREE.Vector3(1, 0, 0);
  const normalVec = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const p = points[i];
    const t = tangents[i];
    normalVec.crossVectors(t, sideVec).normalize();

    const halfW = width / 2;
    positions.push(p.x - halfW, p.y, p.z);
    positions.push(p.x + halfW, p.y, p.z);

    normals.push(normalVec.x, normalVec.y, normalVec.z);
    normals.push(normalVec.x, normalVec.y, normalVec.z);

    const v = i / segments;
    uvs.push(0, v);
    uvs.push(1, v);

    if (i < segments) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * Builds a closed capsule/stadium-shaped timing belt around two pulley centers in XZ.
 */
function createTimingBeltMesh(
  c1: [number, number],
  r1: number,
  c2: [number, number],
  r2: number,
  beltThickness: number,
  beltHeight: number,
  material: THREE.Material
): THREE.Mesh {
  const dx = c2[0] - c1[0];
  const dz = c2[1] - c1[1];
  const dist = Math.hypot(dx, dz);
  const baseAngle = Math.atan2(dz, dx);
  const sinPhi = Math.max(-0.99, Math.min(0.99, (r1 - r2) / Math.max(0.001, dist)));
  const phi = Math.acos(sinPhi);

  const outerShape = new THREE.Shape();
  const R1o = r1 + beltThickness;
  const R2o = r2 + beltThickness;
  const a1Start = baseAngle + phi;
  const a1End = baseAngle - phi + Math.PI * 2;
  outerShape.absarc(c1[0], c1[1], R1o, a1Start, a1End, false);
  outerShape.absarc(c2[0], c2[1], R2o, baseAngle - phi, baseAngle + phi, false);
  outerShape.closePath();

  const innerHole = new THREE.Path();
  innerHole.absarc(c1[0], c1[1], r1, a1Start, a1End, false);
  innerHole.absarc(c2[0], c2[1], r2, baseAngle - phi, baseAngle + phi, false);
  innerHole.closePath();
  outerShape.holes.push(innerHole);

  const geo = new THREE.ExtrudeGeometry(outerShape, {
    depth: beltHeight,
    bevelEnabled: false,
    curveSegments: 28,
  });
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Builds the complete high-fidelity JetBot 3D model closely matching the real CMU lab robot.
 */
export function buildJetBotModel(options: JetBotBuildOptions = {}): JetBotModelRefs {
  const isSoftwareGl = options.isSoftwareGl ?? false;
  const anisotropy = options.maxAnisotropy ?? 4;

  const root = new THREE.Group();
  root.name = 'JetBot';

  // =========================================================================
  // 0. CALIBRATED PBR MATERIAL LIBRARY
  // =========================================================================
  const anodizedMaps = createAnodizedMetalMaps(anisotropy);
  const matChassisGreen = new THREE.MeshStandardMaterial({
    color: 0x15803d, // rich authentic emerald anodized aluminum (matches real lab chassis)
    metalness: 0.56,
    roughness: 0.42,
    envMapIntensity: 0.55,
    bumpMap: anodizedMaps.bumpMap,
    bumpScale: 0.005,
    roughnessMap: anodizedMaps.roughnessMap,
    name: 'mat_chassis_green',
  });

  const matBlueRim = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7, // electric metallic blue anodized alloy (anh3/anh4/anh6)
    metalness: 0.9,
    roughness: 0.16,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    name: 'mat_blue_rim',
  });

  const tireMaps = createTireTreadMaps(anisotropy);
  const matTireRubber = new THREE.MeshStandardMaterial({
    map: tireMaps.map,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.04,
    bumpMap: tireMaps.bumpMap,
    bumpScale: 0.032,
    name: 'mat_tire_rubber',
  });

  const matTireSideRubber = new THREE.MeshStandardMaterial({
    color: 0x17191e,
    roughness: 0.88,
    metalness: 0.04,
    name: 'mat_tire_side_rubber',
  });

  const matBrassHex = new THREE.MeshStandardMaterial({
    color: 0xd49428,
    metalness: 0.9,
    roughness: 0.24,
    name: 'mat_brass',
  });

  const matChrome = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.94,
    roughness: 0.16,
    name: 'mat_chrome',
  });

  const matBrushedSteel = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.88,
    roughness: 0.28,
    bumpMap: anodizedMaps.bumpMap,
    bumpScale: 0.004,
    name: 'mat_brushed_steel',
  });

  const jetsonPcbTex = createPcbTexture('jetson', anisotropy);
  const matJetsonPcb = new THREE.MeshStandardMaterial({
    map: jetsonPcbTex,
    color: 0xffffff,
    roughness: 0.48,
    metalness: 0.18,
    name: 'mat_jetson_pcb',
  });

  const wavesharePcbTex = createPcbTexture('waveshare', anisotropy);
  const matWavesharePcb = new THREE.MeshStandardMaterial({
    map: wavesharePcbTex,
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.2,
    name: 'mat_waveshare_pcb',
  });

  const matAcrylicBlack = new THREE.MeshPhysicalMaterial({
    color: 0x0d1117,
    roughness: 0.44,
    metalness: 0.06,
    clearcoat: 0.24,
    clearcoatRoughness: 0.36,
    envMapIntensity: 0.3,
    name: 'mat_acrylic_black',
  });

  const matBlackAluminum = new THREE.MeshStandardMaterial({
    color: 0x17191f,
    metalness: 0.72,
    roughness: 0.36,
    bumpMap: anodizedMaps.bumpMap,
    bumpScale: 0.004,
    name: 'mat_black_aluminum',
  });

  const matMattePlastic = new THREE.MeshStandardMaterial({
    color: 0x16181e,
    roughness: 0.62,
    metalness: 0.08,
    name: 'mat_plastic',
  });

  const matBatteryCell = new THREE.MeshStandardMaterial({
    color: 0x15803d, // green 18650 Li-ion shrink wrap visible in anh3
    roughness: 0.38,
    metalness: 0.15,
    name: 'mat_battery_cell',
  });

  const matUsbBlue = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.38,
    metalness: 0.08,
  });

  const matWhiteSwitch = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.42,
    metalness: 0.04,
  });

  const matCameraGlass = isSoftwareGl
    ? new THREE.MeshPhysicalMaterial({
        color: 0x0f2744,
        metalness: 0.25,
        roughness: 0.06,
        transparent: true,
        opacity: 0.78,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0x0a1c38,
        metalness: 0.12,
        roughness: 0.04,
        transmission: 0.85,
        thickness: 0.4,
        ior: 1.55,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      });

  // Dedicated sub-groups for exploded view & inspection
  const groupChassis = new THREE.Group();
  groupChassis.name = 'group_chassis';

  const groupWheels = new THREE.Group();
  groupWheels.name = 'group_wheels';
  groupWheels.userData = { id: 'wheels', label: 'Cụm Bánh Xe Vi Sai Mâm Xanh Dương & TT Motor' };

  const groupMotorBoard = new THREE.Group();
  groupMotorBoard.name = 'group_motor_board';
  groupMotorBoard.userData = { id: 'motorBoard', label: 'Mạch Điều Khiển Động Cơ Waveshare & Pin 3S' };

  const groupJetson = new THREE.Group();
  groupJetson.name = 'group_jetson';
  groupJetson.userData = { id: 'jetson', label: 'Bo Mạch NVIDIA Jetson Nano AI' };

  const groupIoPorts = new THREE.Group();
  groupIoPorts.name = 'group_io_ports';
  groupIoPorts.userData = { id: 'ports', label: 'Cụm Cổng Kết Nối Ngoại Vi & GPIO JetBot' };

  const groupTopDeck = new THREE.Group();
  groupTopDeck.name = 'group_top_deck';

  const groupLidar = new THREE.Group();
  groupLidar.name = 'group_lidar';
  groupLidar.userData = { id: 'lidar', label: 'Cảm Biến Laser RPLIDAR A1 360°' };

  const groupCamera = new THREE.Group();
  groupCamera.name = 'group_camera';
  groupCamera.userData = { id: 'camera', label: 'Camera CSI Sony IMX219 8MP & Cáp FFC' };

  const groupAntennas = new THREE.Group();
  groupAntennas.name = 'group_antennas';
  groupAntennas.userData = { id: 'antennas', label: 'Anten Kép Wi-Fi SMA & Dây Coax' };

  // =========================================================================
  // 1. BASE GREEN ANODIZED CHASSIS PLATE, FASTENERS & REAL CASTER FORK
  // =========================================================================
  const chassisShape = new THREE.Shape();
  const R = 1.05;
  const wheelCutoutX = 0.82;
  const wheelCutoutZFront = 0.43;
  const wheelCutoutZBack = -0.43;

  chassisShape.moveTo(0, R);
  chassisShape.absarc(0, 0, R, Math.PI / 2, Math.PI * 0.14, true);
  chassisShape.lineTo(wheelCutoutX, wheelCutoutZFront);
  chassisShape.lineTo(wheelCutoutX - 0.3, wheelCutoutZFront);
  chassisShape.lineTo(wheelCutoutX - 0.3, wheelCutoutZBack);
  chassisShape.lineTo(wheelCutoutX, wheelCutoutZBack);
  chassisShape.absarc(0, 0, R, -Math.PI * 0.14, -Math.PI * 0.86, true);
  chassisShape.lineTo(-wheelCutoutX, wheelCutoutZBack);
  chassisShape.lineTo(-wheelCutoutX + 0.3, wheelCutoutZBack);
  chassisShape.lineTo(-wheelCutoutX + 0.3, wheelCutoutZFront);
  chassisShape.lineTo(-wheelCutoutX, wheelCutoutZFront);
  chassisShape.absarc(0, 0, R, Math.PI * 0.86, Math.PI / 2, true);

  const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  });
  chassisGeo.computeVertexNormals();

  const chassisPlate = new THREE.Mesh(chassisGeo, matChassisGreen);
  chassisPlate.rotation.x = Math.PI / 2;
  chassisPlate.position.set(0, 0.28, 0);
  chassisPlate.castShadow = true;
  chassisPlate.receiveShadow = true;
  groupChassis.add(chassisPlate);

  // Stainless M2.5/M3 Pan-Head Screws via InstancedMesh around chassis standoffs & caster plate
  const screwCoords: [number, number, number][] = [
    [-0.45, 0.295, -0.45],
    [0.45, 0.295, -0.45],
    [-0.45, 0.295, 0.45],
    [0.45, 0.295, 0.45],
    [-0.14, 0.295, 0.72],
    [0.14, 0.295, 0.72],
    [-0.14, 0.295, 0.88],
    [0.14, 0.295, 0.88],
    [-0.11, 0.295, 0.96],
    [0.11, 0.295, 0.96],
  ];
  const screwGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.016, 12);
  const screwInst = new THREE.InstancedMesh(screwGeo, matChrome, screwCoords.length);
  const dummy = new THREE.Object3D();
  screwCoords.forEach(([sx, sy, sz], i) => {
    dummy.position.set(sx, sy, sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    screwInst.setMatrixAt(i, dummy.matrix);
  });
  screwInst.instanceMatrix.needsUpdate = true;
  groupChassis.add(screwInst);

  // Realistic Front Swivel Caster Wheel Assembly (stamped steel fork + cross axle + polyurethane wheel, matching anh7)
  const casterGroup = new THREE.Group();
  casterGroup.position.set(0, 0.24, 0.8);

  const casterTopPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.22), matBrushedSteel);
  casterTopPlate.position.y = 0;
  casterGroup.add(casterTopPlate);

  const casterSwivelRace = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 18), matChrome);
  casterSwivelRace.position.y = -0.025;
  casterGroup.add(casterSwivelRace);

  // Two angled stamped steel fork arms trailing slightly behind swivel axis
  [-0.068, 0.068].forEach((fx) => {
    const forkArm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.17, 0.095), matBrushedSteel);
    forkArm.position.set(fx, -0.1, -0.04);
    forkArm.rotation.x = 0.35;
    forkArm.castShadow = true;
    casterGroup.add(forkArm);
  });

  // Cross axle bolt & polyurethane caster wheel (touches Y=0 cleanly)
  const casterWheelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.085, 24), matMattePlastic);
  casterWheelMesh.rotation.z = Math.PI / 2;
  casterWheelMesh.position.set(0, -0.145, -0.075);
  casterWheelMesh.castShadow = true;
  casterGroup.add(casterWheelMesh);

  const casterAxleBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.165, 12), matChrome);
  casterAxleBolt.rotation.z = Math.PI / 2;
  casterAxleBolt.position.set(0, -0.145, -0.075);
  casterGroup.add(casterAxleBolt);

  groupChassis.add(casterGroup);

  // Two TT DC Geared Motors mounted under chassis with brass axle adapters
  function createMotorUnit(isLeft: boolean) {
    const motorGroup = new THREE.Group();
    const matMotorBody = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.48, metalness: 0.08 });
    const motorBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.38), matMotorBody);
    motorGroup.add(motorBody);

    const motorCan = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.24, 16), matBrushedSteel);
    motorCan.rotation.x = Math.PI / 2;
    motorCan.position.set(0, 0, -0.24);
    motorGroup.add(motorCan);

    // Brass hexagonal wheel-mount hub coupling visible inside wheel cutouts (anh7)
    const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 6), matBrassHex);
    coupling.rotation.z = Math.PI / 2;
    coupling.position.set(isLeft ? -0.22 : 0.22, 0, 0);
    motorGroup.add(coupling);

    motorGroup.position.set(isLeft ? -0.46 : 0.46, 0.24, 0);
    return motorGroup;
  }
  groupChassis.add(createMotorUnit(true));
  groupChassis.add(createMotorUnit(false));

  // =========================================================================
  // 2. DEEP-DISH 10-SPOKE METALLIC BLUE WHEELS & SCULPTED KNOBBY TIRES
  // =========================================================================
  const wheelRadius = 0.38;
  const wheelWidth = 0.23;

  function createJetBotWheel(isLeft: boolean): THREE.Group {
    const wGroup = new THREE.Group();
    wGroup.name = isLeft ? 'LeftWheel' : 'RightWheel';

    const sideSign = isLeft ? -1 : 1;

    // 1. Sculpted Lathe Rubber Tire with rounded shoulders & bead lip
    const hw = wheelWidth / 2;
    const rOuter = wheelRadius;
    const rRim = wheelRadius * 0.67;
    const lathePoints = [
      new THREE.Vector2(rRim, -hw * 0.86),
      new THREE.Vector2(rOuter * 0.93, -hw),
      new THREE.Vector2(rOuter, -hw * 0.72),
      new THREE.Vector2(rOuter, hw * 0.72),
      new THREE.Vector2(rOuter * 0.93, hw),
      new THREE.Vector2(rRim, hw * 0.86),
    ];
    const tireGeo = new THREE.LatheGeometry(lathePoints, 40);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMesh = new THREE.Mesh(tireGeo, matTireRubber);
    tireMesh.castShadow = true;
    tireMesh.receiveShadow = true;
    wGroup.add(tireMesh);

    // Sidewall closure rings (subtle clean bead edge)
    const sidewallGeo = new THREE.RingGeometry(rRim * 0.98, rOuter * 0.94, 40);
    const leftSide = new THREE.Mesh(sidewallGeo, matTireSideRubber);
    leftSide.position.x = -hw * 0.96;
    leftSide.rotation.y = -Math.PI / 2;
    wGroup.add(leftSide);

    const rightSide = new THREE.Mesh(sidewallGeo, matTireSideRubber);
    rightSide.position.x = hw * 0.96;
    rightSide.rotation.y = Math.PI / 2;
    wGroup.add(rightSide);

    // 2. Open-Center Deep-Dish Anodized Blue Outer Rim Barrel (NOT solid!)
    const rimOuterGeo = new THREE.CylinderGeometry(rRim, rRim, wheelWidth * 0.84, 36, 1, true);
    rimOuterGeo.rotateZ(Math.PI / 2);
    const rimBarrelMat = matBlueRim.clone();
    rimBarrelMat.side = THREE.DoubleSide;
    const rimBarrel = new THREE.Mesh(rimOuterGeo, rimBarrelMat);
    wGroup.add(rimBarrel);

    // Outer metallic blue bevel lip ring
    const lipGeo = new THREE.TorusGeometry(rRim - 0.008, 0.014, 12, 36);
    lipGeo.rotateY(Math.PI / 2);
    const outerLip = new THREE.Mesh(lipGeo, matBlueRim);
    outerLip.position.x = sideSign * (hw * 0.82);
    wGroup.add(outerLip);

    // Inner dark recessed brake/hub backing ring deep inside barrel
    const backDiscGeo = new THREE.CylinderGeometry(0.085, 0.085, wheelWidth * 0.55, 20);
    backDiscGeo.rotateZ(Math.PI / 2);
    const backDisc = new THREE.Mesh(backDiscGeo, matMattePlastic);
    backDisc.position.x = -sideSign * 0.025;
    wGroup.add(backDisc);

    // Center recessed anodized blue hub boss
    const hubBossGeo = new THREE.CylinderGeometry(0.08, 0.095, 0.075, 20);
    hubBossGeo.rotateZ(Math.PI / 2);
    const hubBoss = new THREE.Mesh(hubBossGeo, matBlueRim);
    hubBoss.position.x = sideSign * (hw * 0.35);
    wGroup.add(hubBoss);

    // 3. 10 Sculpted Curved/Tapered Metallic Blue Spokes radiating from recessed center to outer lip
    const spokeCount = 10;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i * Math.PI * 2) / spokeCount;
      const spokeGroup = new THREE.Group();
      // Tapered curved blade spoke sloping outward toward rim lip (deep-dish contour in anh4)
      const spokeGeo = new THREE.BoxGeometry(0.024, rRim - 0.065, 0.028);
      const spoke = new THREE.Mesh(spokeGeo, matBlueRim);
      const midR = (0.068 + rRim) * 0.5;
      spoke.position.set(sideSign * (hw * 0.58), Math.cos(angle) * midR, Math.sin(angle) * midR);
      spoke.rotation.x = angle;
      // Dish tilt inward toward center hub
      spoke.rotation.z = sideSign * -0.22;
      spoke.castShadow = true;
      spokeGroup.add(spoke);
      wGroup.add(spokeGroup);
    }

    // 4. Recessed Chrome Center Washer & M4 Socket Cap Bolt (anh4)
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 16), matChrome);
    washer.rotation.z = Math.PI / 2;
    washer.position.x = sideSign * (hw * 0.52);
    wGroup.add(washer);

    const centerBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.032, 8), matChrome);
    centerBolt.rotation.z = Math.PI / 2;
    centerBolt.position.x = sideSign * (hw * 0.58);
    wGroup.add(centerBolt);

    wGroup.position.set(sideSign * 0.85, 0.38, 0);
    wGroup.userData = { id: 'wheels', label: 'Bánh Xe Chủ Động Mâm Xanh Dương Metallic' };
    return wGroup;
  }

  const leftWheel = createJetBotWheel(true);
  const rightWheel = createJetBotWheel(false);
  groupWheels.add(leftWheel);
  groupWheels.add(rightWheel);

  // =========================================================================
  // 3. BRASS HEX STANDOFFS SYSTEM
  // =========================================================================
  function createStandoffPillar(x: number, yBottom: number, z: number, height: number): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(0.032, 0.032, height, 6);
    const mesh = new THREE.Mesh(geo, matBrassHex);
    mesh.position.set(x, yBottom + height / 2, z);
    mesh.castShadow = true;
    return mesh;
  }

  const standoffCoords: [number, number][] = [
    [-0.45, -0.45],
    [0.45, -0.45],
    [-0.45, 0.45],
    [0.45, 0.45],
  ];
  standoffCoords.forEach(([x, z]) => {
    groupChassis.add(createStandoffPillar(x, 0.3, z, 0.2));
  });

  // =========================================================================
  // 4. LOWER EXPANSION BOARD (WAVESHARE) & 3x 18650 BATTERY CRADLE
  // =========================================================================
  // 3-Cell 18650 Battery Cradle mounted on underside of Waveshare board (visible in anh3!)
  const batteryCradle = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.14, 0.66), matMattePlastic);
  batteryCradle.position.set(0, 0.42, -0.08);
  batteryCradle.castShadow = true;
  groupMotorBoard.add(batteryCradle);

  // 3x Green 18650 Li-ion cells peeking out inside the cradle
  for (let i = -1; i <= 1; i++) {
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.78, 16), matBatteryCell);
    cell.rotation.z = Math.PI / 2;
    cell.position.set(0, 0.42, -0.08 + i * 0.19);
    groupMotorBoard.add(cell);

    // Silver cell end caps
    [-0.4, 0.4].forEach((cx) => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 12), matChrome);
      cap.rotation.z = Math.PI / 2;
      cap.position.set(cx, 0.42, -0.08 + i * 0.19);
      groupMotorBoard.add(cap);
    });
  }

  // Waveshare PCB Plate (wider rear shelf matching anh3/anh5)
  const motorBoard = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.032, 1.16), matWavesharePcb);
  motorBoard.position.set(0, 0.51, -0.06);
  motorBoard.castShadow = true;
  motorBoard.receiveShadow = true;
  motorBoard.userData = { id: 'motorBoard', label: 'Mạch Điều Khiển Động Cơ & Nguồn Waveshare' };
  groupMotorBoard.add(motorBoard);

  // 0.91" OLED Display Screen on Front-Left edge of Waveshare board
  const oledTex = createOledDisplayTexture(anisotropy);
  const oledBezel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.025, 0.11), matMattePlastic);
  oledBezel.position.set(-0.28, 0.535, 0.43);
  groupMotorBoard.add(oledBezel);

  const oledScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.078),
    new THREE.MeshBasicMaterial({ map: oledTex })
  );
  oledScreen.rotation.x = -Math.PI / 2;
  oledScreen.position.set(-0.28, 0.55, 0.43);
  groupMotorBoard.add(oledScreen);

  // Buzzer / Trim wheel on right side edge (visible in anh3)
  const buzzer = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.045, 20), matMattePlastic);
  buzzer.position.set(0.45, 0.54, 0.36);
  groupMotorBoard.add(buzzer);

  // White tactile BOOT & RESET pushbuttons on right rear edge (clearly visible in anh3!)
  [0.14, 0.25].forEach((pz) => {
    const btnBase = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 0.055), matChrome);
    btnBase.position.set(0.5, 0.538, -pz);
    groupMotorBoard.add(btnBase);
    const btnCap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.02, 0.032), matWhiteSwitch);
    btnCap.position.set(0.525, 0.542, -pz);
    groupMotorBoard.add(btnCap);
  });

  // Power Slide Switch & 12.6V Charging Barrel Jack at rear/side edge
  const switchBox = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.07), matMattePlastic);
  switchBox.position.set(-0.38, 0.55, -0.59);
  groupMotorBoard.add(switchBox);

  const switchToggle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.035), matChrome);
  switchToggle.position.set(-0.38, 0.575, -0.59);
  groupMotorBoard.add(switchToggle);

  const barrelJack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.14), matMattePlastic);
  barrelJack.position.set(0.38, 0.56, -0.57);
  groupMotorBoard.add(barrelJack);

  const barrelSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), matChrome);
  barrelSleeve.rotation.x = Math.PI / 2;
  barrelSleeve.position.set(0.38, 0.56, -0.64);
  groupMotorBoard.add(barrelSleeve);

  // Standoffs: Lower Board -> Jetson Nano
  standoffCoords.forEach(([x, z]) => {
    groupMotorBoard.add(createStandoffPillar(x, 0.53, z, 0.21));
  });

  // =========================================================================
  // 5. MIDDLE TIER: NVIDIA JETSON NANO BOARD, I/O CLUSTER & FINNED HEATSINK
  // =========================================================================
  const jetsonPcb = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.032, 0.94), matJetsonPcb);
  jetsonPcb.position.set(0, 0.75, -0.05);
  jetsonPcb.castShadow = true;
  jetsonPcb.receiveShadow = true;
  jetsonPcb.userData = { id: 'jetson', label: 'Bo Mạch Xử Lý AI NVIDIA Jetson Nano' };
  groupJetson.add(jetsonPcb);

  // Right-side I/O Shield Cluster facing outward (+X side, matching cổng kết nối 2.jpg!)
  // 1) Stacked Dual USB 3.0 cages (2 double cages side by side)
  [-0.02, 0.17].forEach((zOff) => {
    const usbCage = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.16), matBrushedSteel);
    usbCage.position.set(0.43, 0.85, zOff);
    usbCage.castShadow = true;
    groupIoPorts.add(usbCage);

    // Recessed port cavities + bright blue USB 3.0 tongues
    [-0.038, 0.038].forEach((py) => {
      const darkSlot = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.055, 0.12), matMattePlastic);
      darkSlot.position.set(0.522, 0.85 + py, zOff);
      groupIoPorts.add(darkSlot);

      const blueTongue = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.018, 0.095), matUsbBlue);
      blueTongue.position.set(0.526, 0.85 + py + 0.01, zOff);
      groupIoPorts.add(blueTongue);
    });
  });

  // Waveshare USB-to-USB Bridge Adapter Module bridging Waveshare & Jetson USB (cổng kết nối 2.jpg!)
  const usbBridgeBoard = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.13), matWavesharePcb);
  usbBridgeBoard.position.set(0.548, 0.72, -0.02);
  usbBridgeBoard.castShadow = true;
  groupIoPorts.add(usbBridgeBoard);

  // 2) Gigabit RJ45 Ethernet Cage with Amber/Green Link LEDs & Micro-USB Debug Port
  const ethCage = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.17, 0.19), matBrushedSteel);
  ethCage.position.set(0.42, 0.845, -0.24);
  ethCage.castShadow = true;
  groupIoPorts.add(ethCage);

  const ethSocket = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.13), matMattePlastic);
  ethSocket.position.set(0.525, 0.84, -0.24);
  groupIoPorts.add(ethSocket);

  const ethLedGreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.02, 0.025),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  ethLedGreen.position.set(0.532, 0.79, -0.17);
  groupIoPorts.add(ethLedGreen);

  const ethLedAmber = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.02, 0.025),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b })
  );
  ethLedAmber.position.set(0.532, 0.79, -0.31);
  groupIoPorts.add(ethLedAmber);

  const microUsbPort = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.038, 0.09), matChrome);
  microUsbPort.position.set(0.47, 0.78, -0.41);
  groupIoPorts.add(microUsbPort);

  // 3) Stacked HDMI / DisplayPort Cage & 5V DC Barrel Jack
  const dpHdmiStack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), matBrushedSteel);
  dpHdmiStack.position.set(0.43, 0.85, 0.22);
  groupIoPorts.add(dpHdmiStack);

  const jetsonDcJack = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.11), matMattePlastic);
  jetsonDcJack.position.set(0.44, 0.81, 0.36);
  groupIoPorts.add(jetsonDcJack);

  // 4) 40-Pin Dual-Row Gold GPIO Header using InstancedMesh
  const gpioBase = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.56), matMattePlastic);
  gpioBase.position.set(-0.44, 0.785, -0.05);
  groupIoPorts.add(gpioBase);

  const pinGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.075, 6);
  const gpioPins = new THREE.InstancedMesh(pinGeo, matBrassHex, 40);
  let pinIdx = 0;
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 2; col++) {
      dummy.position.set(-0.462 + col * 0.044, 0.815, -0.31 + row * 0.027);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      gpioPins.setMatrixAt(pinIdx++, dummy.matrix);
    }
  }
  gpioPins.instanceMatrix.needsUpdate = true;
  groupIoPorts.add(gpioPins);

  // 5) Jetson Nano Finned Black Aluminum Heatsink + 40mm Cooling Fan + PWM Wire Loop
  const heatsinkGroup = new THREE.Group();
  heatsinkGroup.name = 'JetsonHeatsink';

  const hsBase = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.055, 0.62), matBlackAluminum);
  heatsinkGroup.add(hsBase);

  for (let f = -0.28; f <= 0.28; f += 0.045) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.2, 0.62), matBlackAluminum);
    fin.position.set(f, 0.11, 0);
    fin.castShadow = true;
    heatsinkGroup.add(fin);
  }

  // Fan mounting frame & 7-blade rotor on top of heatsink
  const fanFrame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), matMattePlastic);
  fanFrame.position.set(0, 0.22, 0);
  heatsinkGroup.add(fanFrame);

  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.055, 16), matBlackAluminum);
  fanHub.position.set(0, 0.225, 0);
  heatsinkGroup.add(fanHub);

  for (let b = 0; b < 7; b++) {
    const ba = (b * Math.PI * 2) / 7;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.036), matMattePlastic);
    blade.position.set(Math.cos(ba) * 0.11, 0.225, Math.sin(ba) * 0.11);
    blade.rotation.y = -ba;
    blade.rotation.x = 0.35;
    heatsinkGroup.add(blade);
  }

  // Yellow + Red PWM fan wire harness peeking neatly on I/O side (anh3)
  const fanWireCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 0.21, 0.05),
    new THREE.Vector3(0.32, 0.16, 0.12),
    new THREE.Vector3(0.34, 0.05, 0.05),
  ]);
  const fanWireRed = new THREE.Mesh(
    new THREE.TubeGeometry(fanWireCurve, 12, 0.01, 6, false),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 })
  );
  heatsinkGroup.add(fanWireRed);

  const fanWireYellow = fanWireRed.clone();
  fanWireYellow.material = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
  fanWireYellow.position.z = 0.018;
  heatsinkGroup.add(fanWireYellow);

  heatsinkGroup.position.set(-0.06, 0.79, -0.06);
  heatsinkGroup.userData = { id: 'jetson', label: 'Tản Nhiệt Nhôm Đen & Quạt PWM' };
  groupJetson.add(heatsinkGroup);

  // Standoffs: Jetson Board -> Top Deck (4 taller brass hex pillars)
  standoffCoords.forEach(([x, z]) => {
    groupJetson.add(createStandoffPillar(x, 0.765, z, 0.43));
  });

  // =========================================================================
  // 6. TOP DECK (MATTE BLACK ACRYLIC) & RPLIDAR A1 WITH BELT DRIVE
  // =========================================================================
  const topDeckMesh = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.032, 1.04), matAcrylicBlack);
  topDeckMesh.position.set(0, 1.21, -0.05);
  topDeckMesh.castShadow = true;
  topDeckMesh.receiveShadow = true;
  groupTopDeck.add(topDeckMesh);

  // 4 Chrome screw caps on top deck corners
  standoffCoords.forEach(([sx, sz]) => {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 12), matChrome);
    cap.position.set(sx, 1.23, sz);
    groupTopDeck.add(cap);
  });

  // 4 Black Nylon Cylindrical Spacers supporting RPLIDAR mounting bridge (anh3)
  const lidarBridgeY = 1.43;
  [
    [-0.36, -0.36],
    [0.36, -0.36],
    [-0.36, 0.28],
    [0.36, 0.28],
  ].forEach(([lx, lz]) => {
    const spacer = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 12), matMattePlastic);
    spacer.position.set(lx, 1.325, lz);
    spacer.castShadow = true;
    groupLidar.add(spacer);
  });

  // RPLIDAR mounting bridge plate (stadium/teardrop outline enclosing turret + side motor)
  const bridgeShape = new THREE.Shape();
  bridgeShape.absarc(0, 0, 0.42, Math.PI * 0.35, Math.PI * 1.65, false);
  bridgeShape.absarc(0.33, 0.08, 0.19, -Math.PI * 0.4, Math.PI * 0.55, false);
  bridgeShape.closePath();
  const bridgeGeo = new THREE.ExtrudeGeometry(bridgeShape, { depth: 0.025, bevelEnabled: false });
  bridgeGeo.rotateX(Math.PI / 2);
  const bridgeMesh = new THREE.Mesh(bridgeGeo, matBlackAluminum);
  bridgeMesh.position.set(0, lidarBridgeY, -0.05);
  bridgeMesh.castShadow = true;
  groupLidar.add(bridgeMesh);

  // Side Brushed-Silver RF-500TB Drive Motor hanging under bridge right side (matching anh3!)
  const lidarMotorGroup = new THREE.Group();
  const motorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.2, 24), matBrushedSteel);
  motorBody.position.y = -0.11;
  motorBody.castShadow = true;
  lidarMotorGroup.add(motorBody);

  const motorShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 12), matChrome);
  motorShaft.position.y = 0.03;
  lidarMotorGroup.add(motorShaft);

  const motorPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.045, 20), matMattePlastic);
  motorPulley.position.y = 0.045;
  lidarMotorGroup.add(motorPulley);

  const pulleyFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.01, 20), matMattePlastic);
  pulleyFlange.position.y = 0.07;
  lidarMotorGroup.add(pulleyFlange);

  lidarMotorGroup.position.set(0.34, lidarBridgeY, 0.03);
  groupLidar.add(lidarMotorGroup);

  // Lower fixed RPLIDAR optical base cylinder
  const lidarBaseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 32), matMattePlastic);
  lidarBaseMesh.position.set(0, lidarBridgeY - 0.08, -0.05);
  lidarBaseMesh.castShadow = true;
  groupLidar.add(lidarBaseMesh);

  // Real Capsule-Shaped Timing Belt wrapping motor pulley & RPLIDAR turret neck!
  const beltMesh = createTimingBeltMesh(
    [0, -0.05],
    0.345,
    [0.34, 0.03],
    0.074,
    0.018,
    0.036,
    matTireSideRubber
  );
  beltMesh.position.y = lidarBridgeY + 0.062;
  groupLidar.add(beltMesh);

  // Black USB Serial Cable curving from RPLIDAR base down into Jetson Nano
  const usbCableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.22, 1.33, 0.18),
    new THREE.Vector3(-0.34, 1.24, 0.42),
    new THREE.Vector3(-0.22, 1.04, 0.48),
    new THREE.Vector3(0.28, 0.87, 0.18),
  ]);
  const usbCableMesh = new THREE.Mesh(new THREE.TubeGeometry(usbCableCurve, 22, 0.016, 8, false), matMattePlastic);
  usbCableMesh.castShadow = true;
  groupLidar.add(usbCableMesh);

  // Rotating RPLIDAR A1 Scanner Turret Head
  const lidarTurret = new THREE.Group();
  lidarTurret.name = 'RPLidarTurret';

  const turretSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.21, 36), matBlackAluminum);
  turretSkirt.castShadow = true;
  lidarTurret.add(turretSkirt);

  // Recessed Top Cap with authentic "RPLIDAR" CanvasTexture (anh1/anh2)
  const rplidarCapTex = createRplidarCapTexture(anisotropy);
  const topCapMat = new THREE.MeshStandardMaterial({
    map: rplidarCapTex,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.12,
    envMapIntensity: 0.24,
  });
  const topTurretCap = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.012, 36), topCapMat);
  topTurretCap.position.y = 0.108;
  topTurretCap.rotation.y = Math.PI / 2;
  lidarTurret.add(topTurretCap);

  // Side Optical Aperture Cutouts & Transmitter/Receiver Coated Lenses (anh1/anh2)
  [-0.07, 0.07].forEach((zLens) => {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.1, 18), matMattePlastic);
    housing.rotation.z = Math.PI / 2;
    housing.position.set(0.35, 0.0, zLens);
    lidarTurret.add(housing);

    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.11, 18), matCameraGlass);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.355, 0.0, zLens);
    lidarTurret.add(lens);
  });

  // Emissive cyan laser dot
  const laserDot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
  laserDot.position.set(0.4, 0.0, 0);
  lidarTurret.add(laserDot);

  // Rotating Laser Beam Line
  const laserBeamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0.4, 0.0, 0),
    new THREE.Vector3(8.5, 0.0, 0),
  ]);
  const laserBeamLine = new THREE.Line(
    laserBeamGeo,
    new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.82 })
  );
  laserBeamLine.name = 'laser_beam_line';
  lidarTurret.add(laserBeamLine);

  const laserFanGeo = new THREE.PlaneGeometry(8.0, 0.22);
  laserFanGeo.rotateX(-Math.PI / 2);
  laserFanGeo.translate(4.4, 0.0, 0);
  const laserFanMesh = new THREE.Mesh(
    laserFanGeo,
    new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.11,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  lidarTurret.add(laserFanMesh);

  lidarTurret.position.set(0, lidarBridgeY + 0.16, -0.05);
  lidarTurret.userData = { id: 'lidar', label: 'Cảm Biến Laser RPLIDAR 360°' };
  groupLidar.add(lidarTurret);

  // =========================================================================
  // 7. FRONT CSI CAMERA BRACKET, BRASS THUMBSCREWS & ARCHING FFC RIBBON (anh2/anh3/anh7)
  // =========================================================================
  const cameraMountGroup = new THREE.Group();
  cameraMountGroup.name = 'CsiCameraAssembly';

  // Bent anodized green sheet-metal L-bracket base foot + rising tapered neck
  const bracketFoot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.024, 0.15), matChassisGreen);
  bracketFoot.position.set(0, 0.312, 0.87);
  bracketFoot.castShadow = true;
  cameraMountGroup.add(bracketFoot);

  // 2 Phillips chrome mounting screws on bracket foot (visible in anh2 & anh7)
  [-0.095, 0.095].forEach((bx) => {
    const bScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.015, 12), matChrome);
    bScrew.position.set(bx, 0.328, 0.86);
    cameraMountGroup.add(bScrew);
  });

  // Tapered green sheet-metal upright bracket (wider at base, narrower at camera ears)
  const uprightShape = new THREE.Shape();
  uprightShape.moveTo(-0.15, 0);
  uprightShape.lineTo(0.15, 0);
  uprightShape.lineTo(0.11, 0.39);
  uprightShape.lineTo(-0.11, 0.39);
  uprightShape.closePath();
  const uprightGeo = new THREE.ExtrudeGeometry(uprightShape, { depth: 0.026, bevelEnabled: false });
  const uprightMesh = new THREE.Mesh(uprightGeo, matChassisGreen);
  uprightMesh.position.set(0, 0.31, 0.92);
  uprightMesh.rotation.x = -0.14;
  uprightMesh.castShadow = true;
  cameraMountGroup.add(uprightMesh);

  // Side mounting ears + Brass Knurled Tilt Thumbscrews (anh2/anh7)
  [-0.125, 0.125].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.11, 0.12), matChassisGreen);
    ear.position.set(ex, 0.67, 0.99);
    cameraMountGroup.add(ear);

    const thumbScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 18), matBrassHex);
    thumbScrew.rotation.z = Math.PI / 2;
    thumbScrew.position.set(ex + (ex < 0 ? -0.032 : 0.032), 0.67, 0.99);
    cameraMountGroup.add(thumbScrew);
  });

  // IMX219 Camera Module PCB (matte black) + 4 micro mounting screws
  const camPcb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.024), matBlackAluminum);
  camPcb.position.set(0, 0.67, 1.01);
  camPcb.rotation.x = -0.12;
  camPcb.castShadow = true;
  cameraMountGroup.add(camPcb);

  [
    [-0.085, 0.085],
    [0.085, 0.085],
    [-0.085, -0.085],
    [0.085, -0.085],
  ].forEach(([cx, cy]) => {
    const cs = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.032, 8), matChrome);
    cs.rotation.x = Math.PI / 2 - 0.12;
    cs.position.set(cx, 0.67 + cy, 1.015);
    cameraMountGroup.add(cs);
  });

  // Stepped Matte Black Wide-Angle Lens Barrel & Coated Optical Front Element
  const camBaseSquare = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.045), matMattePlastic);
  camBaseSquare.rotation.x = -0.12;
  camBaseSquare.position.set(0, 0.665, 1.04);
  cameraMountGroup.add(camBaseSquare);

  const camBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.08, 0.1, 24), matMattePlastic);
  camBarrel.rotation.x = Math.PI / 2 - 0.12;
  camBarrel.position.set(0, 0.66, 1.09);
  cameraMountGroup.add(camBarrel);

  const camFrontRing = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.01, 10, 24), matBlackAluminum);
  camFrontRing.rotation.x = -0.12;
  camFrontRing.position.set(0, 0.654, 1.14);
  cameraMountGroup.add(camFrontRing);

  const camLensGlass = new THREE.Mesh(new THREE.SphereGeometry(0.056, 18, 18), matCameraGlass);
  camLensGlass.scale.set(1, 1, 0.45);
  camLensGlass.position.set(0, 0.654, 1.132);
  cameraMountGroup.add(camLensGlass);

  // Rear 6-pin white JST connector + colored wires (visible in anh3!)
  const jstHeader = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.035), matWhiteSwitch);
  jstHeader.position.set(0, 0.72, 0.985);
  cameraMountGroup.add(jstHeader);

  [0xdc2626, 0xeab308, 0x16a34a].forEach((colHex, idx) => {
    const wireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.025 + idx * 0.025, 0.72, 0.97),
      new THREE.Vector3(0.08 + idx * 0.02, 0.64, 0.85),
      new THREE.Vector3(0.15, 0.56, 0.55),
    ]);
    const wMesh = new THREE.Mesh(
      new THREE.TubeGeometry(wireCurve, 12, 0.008, 6, false),
      new THREE.MeshStandardMaterial({ color: colHex, roughness: 0.55 })
    );
    cameraMountGroup.add(wMesh);
  });

  // Iconic Arching 15-Pin White FFC CSI Ribbon Cable (AWM 20706 + blue stiffener)
  const ffcHeader = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.04), matMattePlastic);
  ffcHeader.position.set(0, 0.77, 1.0);
  cameraMountGroup.add(ffcHeader);

  const ribbonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.785, 0.995),
    new THREE.Vector3(0, 1.28, 0.96),
    new THREE.Vector3(0, 1.5, 0.76),
    new THREE.Vector3(0, 1.32, 0.55),
    new THREE.Vector3(0, 0.92, 0.45),
    new THREE.Vector3(0, 0.77, 0.38),
  ]);
  const ffcTex = createFfcRibbonTexture(anisotropy);
  const matRibbon = new THREE.MeshStandardMaterial({
    map: ffcTex,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const ribbonGeo = createFlatRibbonGeometry(ribbonCurve, 0.165, 36);
  const ribbonMesh = new THREE.Mesh(ribbonGeo, matRibbon);
  ribbonMesh.castShadow = true;
  cameraMountGroup.add(ribbonMesh);

  cameraMountGroup.userData = { id: 'camera', label: 'Camera CSI Sony IMX219 8MP & Cáp FFC' };
  groupCamera.add(cameraMountGroup);

  // =========================================================================
  // 8. DUAL HIGH-GAIN REAR WI-FI ANTENNAS & COAXIAL PIGTAILS
  // =========================================================================
  function createWifiAntenna(isLeft: boolean): THREE.Group {
    const antGroup = new THREE.Group();
    const smaNut = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.055, 6), matBrassHex);
    antGroup.add(smaNut);

    const smaKnurl = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 16), matBrassHex);
    smaKnurl.position.y = 0.045;
    antGroup.add(smaKnurl);

    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.09, 14), matMattePlastic);
    hinge.position.y = 0.11;
    antGroup.add(hinge);

    const antRod = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.038, 0.95, 16), matMattePlastic);
    antRod.position.y = 0.6;
    antRod.castShadow = true;
    antGroup.add(antRod);

    const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), matMattePlastic);
    antTip.position.y = 1.075;
    antGroup.add(antTip);

    // Coaxial U.FL pigtail curving cleanly into Jetson M.2 underneath
    const coaxCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.02, 0),
      new THREE.Vector3(0, -0.14, 0.06),
      new THREE.Vector3(isLeft ? 0.22 : -0.22, -0.06, 0.24),
    ]);
    const coaxMesh = new THREE.Mesh(new THREE.TubeGeometry(coaxCurve, 14, 0.011, 8, false), matMattePlastic);
    antGroup.add(coaxMesh);

    antGroup.position.set(isLeft ? -0.62 : 0.62, 0.31, -0.62);
    antGroup.rotation.x = -0.16;
    antGroup.rotation.z = isLeft ? 0.14 : -0.14;
    antGroup.userData = { id: 'antennas', label: 'Anten Kép Wi-Fi 2.4/5GHz SMA Đa Hướng' };
    return antGroup;
  }

  groupAntennas.add(createWifiAntenna(true));
  groupAntennas.add(createWifiAntenna(false));

  // =========================================================================
  // 9. LOW-PROFILE UNDER-LIP LED HEADLIGHTS & RECESSED BRAKE LIGHTS
  // =========================================================================
  // Tucked sleekly along front bevel lip so the clean green wing silhouette (anh2/anh7) stays intact!
  const matHeadlightLens = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfffaed,
    emissiveIntensity: 2.2,
    roughness: 0.12,
  });

  const leftSpot = new THREE.SpotLight(0xfffaed, 2.5, 18, Math.PI / 5, 0.5, 1.2);
  leftSpot.position.set(-0.34, 0.26, 0.99);
  leftSpot.target.position.set(-0.25, 0.04, 14.0);
  leftSpot.castShadow = !isSoftwareGl;

  const rightSpot = new THREE.SpotLight(0xfffaed, 2.5, 18, Math.PI / 5, 0.5, 1.2);
  rightSpot.position.set(0.34, 0.26, 0.99);
  rightSpot.target.position.set(0.25, 0.04, 14.0);
  rightSpot.castShadow = !isSoftwareGl;

  [-0.34, 0.34].forEach((hx) => {
    const podHousing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.036, 0.05), matBlackAluminum);
    podHousing.position.set(hx, 0.252, 0.96);
    podHousing.rotation.y = hx < 0 ? -0.22 : 0.22;
    groupChassis.add(podHousing);

    const podLens = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.022, 0.015), matHeadlightLens);
    podLens.position.set(hx, 0.252, 0.985);
    podLens.rotation.y = hx < 0 ? -0.22 : 0.22;
    groupChassis.add(podLens);
  });

  groupChassis.add(leftSpot);
  groupChassis.add(leftSpot.target);
  groupChassis.add(rightSpot);
  groupChassis.add(rightSpot.target);

  // Rear Tail / Brake Lights tucked under rear edge
  const matTailLight = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.8,
  });
  const leftTail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.025), matTailLight);
  leftTail.position.set(-0.46, 0.27, -0.94);
  groupChassis.add(leftTail);

  const rightTail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.025), matTailLight);
  rightTail.position.set(0.46, 0.27, -0.94);
  groupChassis.add(rightTail);

  const rearBrakeGlow = new THREE.PointLight(0xef4444, 0.4, 3.5);
  rearBrakeGlow.position.set(0, 0.29, -1.04);
  groupChassis.add(rearBrakeGlow);

  // Stereo & Dimension Box
  const groupStereoCamera = createStereoCameraGroup(matMattePlastic, matBlackAluminum, matCameraGlass);
  groupStereoCamera.userData = { id: 'stereoCamera', label: 'Cụm Camera Kép Stereo Depth' };
  const dimensionBox = createDimensionBox();

  // 3D Exploded Assembly Axis Guides (visible proportionally when exploded > 3%)
  const explodeGuidesGroup = createExplodedAxisGuides();
  explodeGuidesGroup.visible = false;

  // 3D Active Selection Highlight Box Helper
  const selectionBox = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const selectionBoxHelper = new THREE.Box3Helper(selectionBox, new THREE.Color(0x10b981));
  selectionBoxHelper.name = 'selection_highlight_box';
  selectionBoxHelper.visible = false;
  selectionBoxHelper.userData.isGuideVisual = true;
  selectionBoxHelper.raycast = () => {};

  // Autonomy Visual Guides (Lightweight WebGL overlays on arena floor around robot)
  const lidarGuideGroup = new THREE.Group();
  lidarGuideGroup.name = 'autonomy_lidar_guide';
  lidarGuideGroup.visible = false;

  const lidarArcMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const lidarArcGeo = new THREE.RingGeometry(1.18, 1.32, 32, 1, Math.PI * 0.12, Math.PI * 0.76);
  lidarArcGeo.rotateX(-Math.PI / 2);
  // Orient arc toward +Z (front of JetBot)
  lidarArcGeo.rotateY(Math.PI);
  const lidarSafetyArc = new THREE.Mesh(lidarArcGeo, lidarArcMat);
  lidarSafetyArc.position.y = 0.035;
  lidarSafetyArc.userData.isGuideVisual = true;
  lidarGuideGroup.add(lidarSafetyArc);

  const gapPivot = new THREE.Group();
  gapPivot.position.y = 0.05;
  const gapMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.88, depthWrite: false });
  const gapShaft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 1.35), gapMat);
  gapShaft.position.z = 1.65;
  gapShaft.userData.isGuideVisual = true;
  gapPivot.add(gapShaft);

  const gapHead = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), gapMat);
  gapHead.rotation.x = Math.PI / 2;
  gapHead.position.z = 2.42;
  gapHead.userData.isGuideVisual = true;
  gapPivot.add(gapHead);
  lidarGuideGroup.add(gapPivot);

  const lineGuideGroup = new THREE.Group();
  lineGuideGroup.name = 'autonomy_line_guide';
  lineGuideGroup.visible = false;

  const roiGeo = new THREE.BufferGeometry();
  roiGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      -0.48, 0.032, 1.15,   0.48, 0.032, 1.15,
       0.48, 0.032, 1.15,   0.85, 0.032, 2.45,
       0.85, 0.032, 2.45,  -0.85, 0.032, 2.45,
      -0.85, 0.032, 2.45,  -0.48, 0.032, 1.15,
    ], 3)
  );
  const roiLineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.78 });
  const roiFrame = new THREE.LineSegments(roiGeo, roiLineMat);
  roiFrame.userData.isGuideVisual = true;
  lineGuideGroup.add(roiFrame);

  const lineTargetMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.92, depthWrite: false });
  const lineTargetMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 18), lineTargetMat);
  lineTargetMarker.position.set(0, 0.04, 1.85);
  lineTargetMarker.userData.isGuideVisual = true;
  lineGuideGroup.add(lineTargetMarker);

  root.add(groupChassis);
  root.add(groupWheels);
  root.add(groupMotorBoard);
  root.add(groupJetson);
  root.add(groupIoPorts);
  root.add(groupTopDeck);
  root.add(groupLidar);
  root.add(groupCamera);
  root.add(groupAntennas);
  root.add(groupStereoCamera);
  root.add(dimensionBox);
  root.add(explodeGuidesGroup);
  root.add(selectionBoxHelper);
  root.add(lidarGuideGroup);
  root.add(lineGuideGroup);

  // Preserve original material references and mark guide visuals non-raycastable
  root.traverse((child) => {
    if (child.userData?.isGuideVisual || child.parent?.name === 'dimension_calipers_box') {
      child.userData.isGuideVisual = true;
      child.raycast = () => {};
    }
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.userData.origMaterial = mesh.material;
      let curr: THREE.Object3D | null = mesh;
      while (curr && curr !== root) {
        if (curr.userData && curr.userData.id) {
          mesh.userData.id = curr.userData.id;
          if (curr.userData.label && !mesh.userData.label) {
            mesh.userData.label = curr.userData.label;
          }
          break;
        }
        curr = curr.parent;
      }
    }
  });

  // Shader Style Materials
  const matWireframe = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
  });

  const matClay = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    roughness: 0.92,
    metalness: 0.05,
  });

  const matXray = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.36,
    roughness: 0.12,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    depthWrite: false,
    ...(isSoftwareGl ? {} : { transmission: 0.72 }),
  });

  const matGhost = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.1,
    roughness: 0.15,
    depthWrite: false,
    ...(isSoftwareGl ? {} : { transmission: 0.85 }),
  });

  const matThermalHot = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.45,
    roughness: 0.4,
  });
  const matThermalWarm = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const matThermalMed = new THREE.MeshStandardMaterial({
    color: 0x84cc16,
    emissive: 0x4d7c0f,
    emissiveIntensity: 0.25,
    roughness: 0.4,
  });
  const matThermalCool = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0e7490,
    emissiveIntensity: 0.2,
    roughness: 0.4,
  });

  // Track synchronized Studio/Anatomy state
  let activeRenderStyle: RenderShaderStyle = 'pbr';
  let activeVariant: ModelVariant = 'rplidar';
  let currentExplodeProgress = 0;
  let highlightedPartId: string | null = null;
  let isolationState: { partId: string | null; mode: 'solo' | 'ghost' | 'none' } = {
    partId: null,
    mode: 'none',
  };
  const partVisibilityMap: Record<string, boolean> = {
    wheels: true,
    motorBoard: true,
    jetsonNano: true,
    ports: true,
    lidar: true,
    camera: true,
    antennas: true,
    stereo: false,
  };

  const applyEffectiveVisibility = () => {
    groupChassis.visible = true;
    groupWheels.visible = partVisibilityMap.wheels;
    groupMotorBoard.visible = partVisibilityMap.motorBoard;
    groupJetson.visible = partVisibilityMap.jetsonNano;
    groupIoPorts.visible = partVisibilityMap.ports;
    groupTopDeck.visible = true;
    groupAntennas.visible = partVisibilityMap.antennas;

    const variantLidar = activeVariant === 'rplidar';
    const variantCamera = activeVariant !== 'stereo';
    const variantStereo = activeVariant === 'stereo';

    groupLidar.visible = variantLidar && partVisibilityMap.lidar;
    groupCamera.visible = variantCamera && partVisibilityMap.camera;
    groupStereoCamera.visible = variantStereo && (partVisibilityMap.stereo ?? true);
  };

  const applyShaderMaterials = (style: RenderShaderStyle) => {
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.parent?.name === 'dimension_calipers_box' || mesh.userData.isGuideVisual) return;

        if (style === 'pbr') {
          mesh.material = mesh.userData.origMaterial;
        } else if (style === 'wireframe') {
          mesh.material = matWireframe;
        } else if (style === 'clay') {
          mesh.material = matClay;
        } else if (style === 'xray') {
          mesh.material = matXray;
        } else if (style === 'thermal') {
          const id = mesh.userData.id;
          if (id === 'jetson') {
            mesh.material = matThermalHot;
          } else if (id === 'wheels' || id === 'motorBoard') {
            mesh.material = matThermalWarm;
          } else if (id === 'lidar' || id === 'camera' || id === 'stereoCamera') {
            mesh.material = matThermalMed;
          } else {
            mesh.material = matThermalCool;
          }
        }
      }
    });
  };

  const getSubGroupById = (id: string): THREE.Group | null => {
    if (id === 'wheels') return groupWheels;
    if (id === 'motorBoard' || id === 'board') return groupMotorBoard;
    if (id === 'jetson' || id === 'jetsonNano') return groupJetson;
    if (id === 'ports') return groupIoPorts;
    if (id === 'lidar') return groupLidar;
    if (id === 'camera') return groupCamera;
    if (id === 'antennas') return groupAntennas;
    if (id === 'stereoCamera' || id === 'stereo') return groupStereoCamera;
    return null;
  };

  const refreshSelectionHighlightBox = () => {
    if (!highlightedPartId) {
      selectionBoxHelper.visible = false;
      return;
    }
    const targetGroup = getSubGroupById(highlightedPartId);
    if (!targetGroup || !targetGroup.visible) {
      selectionBoxHelper.visible = false;
      return;
    }
    root.updateMatrixWorld(true);
    const worldBox = new THREE.Box3().setFromObject(targetGroup);
    if (worldBox.isEmpty()) {
      selectionBoxHelper.visible = false;
      return;
    }
    const invRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    worldBox.applyMatrix4(invRoot);
    worldBox.expandByScalar(0.035);
    selectionBox.copy(worldBox);
    selectionBoxHelper.visible = true;
  };

  const setHighlightedPart = (partId: string | null) => {
    highlightedPartId = partId;
    refreshSelectionHighlightBox();
  };

  const setRenderStyle = (style: RenderShaderStyle) => {
    activeRenderStyle = style;
    if (isolationState.mode === 'none' || !isolationState.partId) {
      applyShaderMaterials(style);
    }
  };

  const setChassisColor = (colorHex: number) => {
    matChassisGreen.color.setHex(colorHex);
  };

  const setPartVisibility = (partId: string, visible: boolean) => {
    if (partId === 'jetson') partVisibilityMap.jetsonNano = visible;
    else if (partId === 'stereoCamera') partVisibilityMap.stereo = visible;
    else partVisibilityMap[partId] = visible;

    if (isolationState.mode === 'none' || !isolationState.partId) {
      applyEffectiveVisibility();
    }
  };

  const setDimensionsVisible = (visible: boolean) => {
    dimensionBox.visible = visible;
  };

  const setVariant = (variant: ModelVariant) => {
    activeVariant = variant;
    if (variant === 'rplidar') {
      partVisibilityMap.lidar = true;
      partVisibilityMap.camera = true;
      partVisibilityMap.stereo = false;
    } else if (variant === 'standard') {
      partVisibilityMap.lidar = false;
      partVisibilityMap.camera = true;
      partVisibilityMap.stereo = false;
    } else if (variant === 'stereo') {
      partVisibilityMap.lidar = false;
      partVisibilityMap.camera = false;
      partVisibilityMap.stereo = true;
    }
    if (isolationState.mode === 'none' || !isolationState.partId) {
      applyEffectiveVisibility();
    }
  };

  const getMeshStats = () => {
    let vertices = 0;
    let triangles = 0;
    let meshes = 0;
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.userData.isGuideVisual || mesh.parent?.name === 'dimension_calipers_box') return;
        const countMult = (mesh as THREE.InstancedMesh).isInstancedMesh
          ? (mesh as THREE.InstancedMesh).count
          : 1;
        meshes++;
        const geo = mesh.geometry;
        if (geo.attributes.position) {
          vertices += geo.attributes.position.count * countMult;
        }
        if (geo.index) {
          triangles += (geo.index.count / 3) * countMult;
        } else if (geo.attributes.position) {
          triangles += Math.floor(geo.attributes.position.count / 3) * countMult;
        }
      }
    });
    return { vertices, triangles: Math.round(triangles), meshes };
  };

  const basePositions = {
    chassisY: groupChassis.position.y,
    leftWheelX: leftWheel.position.x,
    rightWheelX: rightWheel.position.x,
    motorBoardY: groupMotorBoard.position.y,
    jetsonY: groupJetson.position.y,
    ioPortsY: groupIoPorts.position.y,
    topDeckY: groupTopDeck.position.y,
    lidarY: groupLidar.position.y,
    cameraY: groupCamera.position.y,
    cameraZ: groupCamera.position.z,
    antennasY: groupAntennas.position.y,
    antennasZ: groupAntennas.position.z,
    stereoY: groupStereoCamera.position.y,
    stereoZ: groupStereoCamera.position.z,
  };

  const setExplodeProgress = (progress: number) => {
    const p = Math.max(0, Math.min(1, progress));
    currentExplodeProgress = p;
    const o = computeJetBotExplodedOffsets(p);

    groupChassis.position.y = basePositions.chassisY + o.chassis.y;
    groupWheels.position.x = 0;
    leftWheel.position.x = basePositions.leftWheelX + o.leftWheel.x;
    rightWheel.position.x = basePositions.rightWheelX + o.rightWheel.x;
    groupMotorBoard.position.y = basePositions.motorBoardY + o.motorBoard.y;
    groupJetson.position.y = basePositions.jetsonY + o.jetson.y;
    groupIoPorts.position.y = basePositions.ioPortsY + o.jetson.y;
    groupIoPorts.position.x = 0.16 * o.eased;
    groupTopDeck.position.y = basePositions.topDeckY + o.topDeck.y;
    groupLidar.position.y = basePositions.lidarY + o.lidar.y;

    groupCamera.position.y = basePositions.cameraY + o.camera.y;
    groupCamera.position.z = basePositions.cameraZ + o.camera.z;

    groupAntennas.position.y = basePositions.antennasY + o.antennas.y;
    groupAntennas.position.z = basePositions.antennasZ + o.antennas.z;

    groupStereoCamera.position.y = basePositions.stereoY + o.stereoCamera.y;
    groupStereoCamera.position.z = basePositions.stereoZ + o.stereoCamera.z;

    // Show exploded assembly guide lines & scale opacity with progress
    explodeGuidesGroup.visible = o.eased > 0.03;
    explodeGuidesGroup.traverse((child) => {
      const line = child as THREE.LineSegments;
      if (line.material) {
        const mat = line.material as THREE.LineDashedMaterial;
        mat.opacity = Math.min(0.82, o.eased * 0.9);
      }
    });

    if (highlightedPartId) {
      refreshSelectionHighlightBox();
    }
  };

  const getExplodeProgress = () => currentExplodeProgress;

  const updateWheelRotations = (leftDelta: number, rightDelta: number) => {
    leftWheel.rotation.x += leftDelta;
    rightWheel.rotation.x += rightDelta;
  };

  const updateLidarRotation = (deltaRad: number) => {
    lidarTurret.rotation.y += deltaRad;
  };

  const isolatePart = (partId: string | null, mode: 'solo' | 'ghost' | 'none') => {
    isolationState = { partId, mode };
    if (!partId || mode === 'none') {
      applyShaderMaterials(activeRenderStyle);
      applyEffectiveVisibility();
      refreshSelectionHighlightBox();
      return;
    }

    const targetGroup = getSubGroupById(partId);
    if (!targetGroup) return;

    if (mode === 'solo') {
      const allGroups = [
        groupChassis,
        groupWheels,
        groupMotorBoard,
        groupJetson,
        groupIoPorts,
        groupTopDeck,
        groupLidar,
        groupCamera,
        groupAntennas,
        groupStereoCamera,
      ];
      allGroups.forEach((g) => {
        g.visible = g === targetGroup;
      });

      targetGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.userData.isGuideVisual) return;
          if (mesh.userData.origMaterial) {
            mesh.material = mesh.userData.origMaterial;
          }
        }
      });
    } else if (mode === 'ghost') {
      applyEffectiveVisibility();
      // Always ensure the inspected component itself is visible in ghost mode
      targetGroup.visible = true;

      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.parent?.name === 'dimension_calipers_box' || mesh.userData.isGuideVisual) return;

          let p: THREE.Object3D | null = mesh;
          let isInsideTarget = false;
          while (p && p !== root) {
            if (p === targetGroup) {
              isInsideTarget = true;
              break;
            }
            p = p.parent;
          }

          if (isInsideTarget) {
            if (mesh.userData.origMaterial) {
              mesh.material = mesh.userData.origMaterial;
            }
          } else {
            mesh.material = matGhost;
          }
        }
      });
    }
    refreshSelectionHighlightBox();
  };

  const getPartBounding = (partId: string): { center: THREE.Vector3; size: THREE.Vector3; radius: number } | null => {
    const targetGroup = getSubGroupById(partId);
    if (!targetGroup) return null;

    targetGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(targetGroup);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    return {
      center,
      size,
      radius: sphere.radius || 0.6,
    };
  };

  let currentPitch = 0;
  let currentRoll = 0;

  const updateMotionDynamics = (
    linearVel: number,
    angularVel: number,
    isBraking: boolean,
    _turnDir: number,
    dt: number
  ) => {
    const isExploded = currentExplodeProgress > 0.02;
    let targetPitch = 0;
    if (!isExploded) {
      if (isBraking) {
        targetPitch = 0.038;
        matTailLight.emissiveIntensity = 2.8;
        rearBrakeGlow.intensity = 1.6;
      } else if (linearVel > 0.05) {
        targetPitch = -0.022 * Math.min(1.0, linearVel / 2.2);
        matTailLight.emissiveIntensity = 0.8;
        rearBrakeGlow.intensity = 0.4;
      } else if (linearVel < -0.05) {
        targetPitch = 0.024;
        matTailLight.emissiveIntensity = 2.0;
        rearBrakeGlow.intensity = 1.0;
      } else {
        targetPitch = 0;
        matTailLight.emissiveIntensity = 0.8;
        rearBrakeGlow.intensity = 0.4;
      }
    }

    const targetRoll = isExploded ? 0 : -0.04 * angularVel;

    currentPitch += (targetPitch - currentPitch) * Math.min(1, dt * 9);
    currentRoll += (targetRoll - currentRoll) * Math.min(1, dt * 9);

    groupChassis.rotation.x = currentPitch;
    groupChassis.rotation.z = currentRoll;
    groupMotorBoard.rotation.x = currentPitch;
    groupMotorBoard.rotation.z = currentRoll;
    groupJetson.rotation.x = currentPitch;
    groupJetson.rotation.z = currentRoll;
    groupTopDeck.rotation.x = currentPitch;
    groupTopDeck.rotation.z = currentRoll;
    groupLidar.rotation.x = currentPitch;
    groupLidar.rotation.z = currentRoll;
    groupCamera.rotation.x = currentPitch;
    groupCamera.rotation.z = currentRoll;
    groupAntennas.rotation.x = currentPitch;
    groupAntennas.rotation.z = currentRoll;
  };

  const setHeadlights = (enabled: boolean) => {
    leftSpot.visible = enabled;
    rightSpot.visible = enabled;
    matHeadlightLens.emissiveIntensity = enabled ? 2.2 : 0.2;
  };

  const setLaserBeamVisible = (enabled: boolean) => {
    laserBeamLine.visible = enabled;
    laserFanMesh.visible = enabled;
  };

  const updateAutonomyVisuals = (params: {
    mode: 'manual' | 'obstacle_avoidance' | 'line_follower';
    steerAngle: number;
    targetGapDeg?: number;
    lineError?: number;
    lineDetected?: boolean;
    isObstacleStop?: boolean;
  }) => {
    if (params.mode === 'obstacle_avoidance') {
      lidarGuideGroup.visible = true;
      lineGuideGroup.visible = false;
      const deg = params.targetGapDeg ?? 0;
      // Positive angleDeg = LEFT (+heading), Three.js rotation.y positive also turns +Z toward +X (LEFT)
      gapPivot.rotation.y = (deg * Math.PI) / 180;
      if (params.isObstacleStop) {
        lidarArcMat.color.setHex(0xef4444);
        gapMat.color.setHex(0xf97316);
      } else if (Math.abs(params.steerAngle) > 0.35) {
        lidarArcMat.color.setHex(0xf59e0b);
        gapMat.color.setHex(0x38bdf8);
      } else {
        lidarArcMat.color.setHex(0x10b981);
        gapMat.color.setHex(0x22d3ee);
      }
    } else if (params.mode === 'line_follower') {
      lidarGuideGroup.visible = false;
      lineGuideGroup.visible = true;
      const err = Math.max(-1, Math.min(1, params.lineError ?? 0));
      // Robot right = -X, robot left = +X in local frame; lineError > 0 means line is on right (-X)
      lineTargetMarker.position.x = -err * 0.65;
      if (params.isObstacleStop) {
        roiLineMat.color.setHex(0xef4444);
        lineTargetMat.color.setHex(0xef4444);
      } else if (params.lineDetected) {
        roiLineMat.color.setHex(0x10b981);
        lineTargetMat.color.setHex(0x22d3ee);
      } else {
        roiLineMat.color.setHex(0xf59e0b);
        lineTargetMat.color.setHex(0xf59e0b);
      }
    } else {
      lidarGuideGroup.visible = false;
      lineGuideGroup.visible = false;
    }
  };

  return {
    rootGroup: root,
    leftWheel,
    rightWheel,
    lidarTurret,
    dimensionBoxGroup: dimensionBox,
    stereoCameraGroup: groupStereoCamera,
    subGroups: {
      chassis: groupChassis,
      wheels: groupWheels,
      motorBoard: groupMotorBoard,
      jetsonNano: groupJetson,
      ports: groupIoPorts,
      topDeck: groupTopDeck,
      lidar: groupLidar,
      camera: groupCamera,
      antennas: groupAntennas,
      stereoCamera: groupStereoCamera,
    },
    setExplodeProgress,
    getExplodeProgress,
    setHighlightedPart,
    updateWheelRotations,
    updateLidarRotation,
    setRenderStyle,
    setChassisColor,
    setPartVisibility,
    setDimensionsVisible,
    setVariant,
    getMeshStats,
    isolatePart,
    getPartBounding,
    setHeadlights,
    setLaserBeamVisible,
    updateMotionDynamics,
    updateAutonomyVisuals,
  };
}

/**
 * Creates dashed CAD alignment guide lines showing the exact assembly paths
 * for the 4 standoff pillars, bilateral wheel axles, front camera rail, and rear antennas.
 */
function createExplodedAxisGuides(): THREE.Group {
  const guideGroup = new THREE.Group();
  guideGroup.name = 'exploded_axis_guides';
  guideGroup.userData.isGuideVisual = true;

  const cyanVerts: number[] = [];
  // 4 standoff vertical assembly axes
  const pillars: [number, number][] = [
    [-0.45, -0.45],
    [0.45, -0.45],
    [-0.45, 0.45],
    [0.45, 0.45],
  ];
  pillars.forEach(([x, z]) => {
    cyanVerts.push(x, 0.18, z, x, 2.32, z);
  });
  // Central optical LiDAR stack axis
  cyanVerts.push(0, 1.15, -0.05, 0, 2.95, -0.05);

  const cyanGeo = new THREE.BufferGeometry();
  cyanGeo.setAttribute('position', new THREE.Float32BufferAttribute(cyanVerts, 3));
  const cyanMat = new THREE.LineDashedMaterial({
    color: 0x38bdf8,
    dashSize: 0.06,
    gapSize: 0.04,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const cyanLines = new THREE.LineSegments(cyanGeo, cyanMat);
  cyanLines.computeLineDistances();
  cyanLines.userData.isGuideVisual = true;
  guideGroup.add(cyanLines);

  // Lateral Wheel Axle + Camera + Antenna axial guide lines in Emerald
  const accentVerts: number[] = [
    // Left wheel axle guide
    -0.55, 0.38, 0, -1.42, 0.38, 0,
    // Right wheel axle guide
    0.55, 0.38, 0, 1.42, 0.38, 0,
    // Front CSI camera guide axis
    0, 0.62, 0.85, 0, 0.9, 1.56,
    // Left & right SMA antenna coax guide axes
    -0.62, 0.32, -0.62, -0.62, 0.78, -1.08,
    0.62, 0.32, -0.62, 0.62, 0.78, -1.08,
  ];
  const accentGeo = new THREE.BufferGeometry();
  accentGeo.setAttribute('position', new THREE.Float32BufferAttribute(accentVerts, 3));
  const accentMat = new THREE.LineDashedMaterial({
    color: 0x10b981,
    dashSize: 0.05,
    gapSize: 0.035,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const accentLines = new THREE.LineSegments(accentGeo, accentMat);
  accentLines.computeLineDistances();
  accentLines.userData.isGuideVisual = true;
  guideGroup.add(accentLines);

  return guideGroup;
}

/**
 * Creates 3D text sprites for technical CAD measurement labels.
 */
function createDimensionTextSprite(text: string, color = '#38bdf8', bgColor = 'rgba(15, 23, 42, 0.94)'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 70;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.fillStyle = bgColor;
  if (ctx.roundRect) {
    ctx.roundRect(4, 4, 292, 62, 10);
  } else {
    ctx.rect(4, 4, 292, 62);
  }
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "JetBrains Mono", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 150, 35);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.68, 0.16, 1);
  sprite.renderOrder = 30;
  return sprite;
}

/**
 * Technical CAD Dimension Bounding Box & Calipers
 */
function createDimensionBox(): THREE.Group {
  const boxGroup = new THREE.Group();
  boxGroup.name = 'dimension_calipers_box';

  const minX = -0.96, maxX = 0.96;
  const minY = 0.0, maxY = 1.8;
  const minZ = -0.95, maxZ = 1.15;

  const boxGeo = new THREE.BufferGeometry();
  const boxVerts = new Float32Array([
    minX, minY, minZ,  maxX, minY, minZ,
    maxX, minY, minZ,  maxX, minY, maxZ,
    maxX, minY, maxZ,  minX, minY, maxZ,
    minX, minY, maxZ,  minX, minY, minZ,
    minX, maxY, minZ,  maxX, maxY, minZ,
    maxX, maxY, minZ,  maxX, maxY, maxZ,
    maxX, maxY, maxZ,  minX, maxY, maxZ,
    minX, maxY, maxZ,  minX, maxY, minZ,
    minX, minY, minZ,  minX, maxY, minZ,
    maxX, minY, minZ,  maxX, maxY, minZ,
    maxX, minY, maxZ,  maxX, maxY, maxZ,
    minX, minY, maxZ,  minX, maxY, maxZ,
  ]);
  boxGeo.setAttribute('position', new THREE.BufferAttribute(boxVerts, 3));
  const boxLines = new THREE.LineSegments(
    boxGeo,
    new THREE.LineBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.72, depthTest: false, depthWrite: false })
  );
  boxLines.renderOrder = 25;
  boxGroup.add(boxLines);

  const cornerGeo = new THREE.BufferGeometry();
  const cornerLen = 0.15;
  const cv: number[] = [];
  const corners = [
    [minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [minX, minY, maxZ],
    [minX, maxY, minZ], [maxX, maxY, minZ], [maxX, maxY, maxZ], [minX, maxY, maxZ],
  ];
  for (const [cx, cy, cz] of corners) {
    const sx = cx < 0 ? 1 : -1;
    const sy = cy <= 0.01 ? 1 : -1;
    const sz = cz < 0 ? 1 : -1;
    cv.push(cx, cy, cz,  cx + sx * cornerLen, cy, cz);
    cv.push(cx, cy, cz,  cx, cy + sy * cornerLen, cz);
    cv.push(cx, cy, cz,  cx, cy, cz + sz * cornerLen);
  }
  cornerGeo.setAttribute('position', new THREE.Float32BufferAttribute(cv, 3));
  const cornerLines = new THREE.LineSegments(
    cornerGeo,
    new THREE.LineBasicMaterial({ color: 0x10b981, depthTest: false, depthWrite: false })
  );
  cornerLines.renderOrder = 26;
  boxGroup.add(cornerLines);

  const spriteLength = createDimensionTextSprite('Chiều dài: 210 mm', '#06b6d4');
  spriteLength.position.set(maxX + 0.30, 0.16, 0.45);
  boxGroup.add(spriteLength);

  const spriteWidth = createDimensionTextSprite('Bề rộng: 175 mm', '#06b6d4');
  spriteWidth.position.set(-0.22, 0.14, maxZ + 0.32);
  boxGroup.add(spriteWidth);

  const spriteHeight = createDimensionTextSprite('Chiều cao: 165 mm', '#10b981');
  spriteHeight.position.set(maxX + 0.32, maxY * 0.68, -0.45);
  boxGroup.add(spriteHeight);

  const spriteClearance = createDimensionTextSprite('Gầm xe: 18 mm', '#f59e0b');
  spriteClearance.position.set(0.58, 0.10, maxZ + 0.28);
  boxGroup.add(spriteClearance);

  const spriteWheel = createDimensionTextSprite('Bánh: ⌀65 mm', '#38bdf8');
  spriteWheel.position.set(maxX + 0.32, 0.56, 0.05);
  boxGroup.add(spriteWheel);

  boxGroup.visible = false;
  return boxGroup;
}

/**
 * Procedural Stereoscopic Dual-Camera Module
 */
function createStereoCameraGroup(matPlastic: THREE.Material, matMetal: THREE.Material, matGlass: THREE.Material): THREE.Group {
  const stereoGroup = new THREE.Group();
  stereoGroup.name = 'group_stereo_camera';

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.06), matMetal);
  bar.position.set(0, 0.65, 1.05);
  stereoGroup.add(bar);

  const leftLens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 16), matPlastic);
  leftLens.rotation.x = Math.PI / 2;
  leftLens.position.set(-0.25, 0.65, 1.1);
  stereoGroup.add(leftLens);

  const leftGlass = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), matGlass);
  leftGlass.position.set(-0.25, 0.65, 1.15);
  stereoGroup.add(leftGlass);

  const rightLens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 16), matPlastic);
  rightLens.rotation.x = Math.PI / 2;
  rightLens.position.set(0.25, 0.65, 1.1);
  stereoGroup.add(rightLens);

  const rightGlass = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), matGlass);
  rightGlass.position.set(0.25, 0.65, 1.15);
  stereoGroup.add(rightGlass);

  stereoGroup.visible = false;
  return stereoGroup;
}

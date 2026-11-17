/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { EnvironmentTheme, MapZoneInfo } from '../../types/jetbot';

export interface ObstacleObject {
  mesh: THREE.Object3D;
  type: 'cone' | 'box' | 'cup' | 'wall' | 'barrel' | 'sign' | 'rack';
  label: string;
  radius: number;
  position: THREE.Vector3;
  halfSize?: THREE.Vector3;
}

export const ARENA_HALF_SIZE = 29.0;
export const ARENA_SAFE_BOUND = 28.2;

export const MAP_ZONES: MapZoneInfo[] = [
  {
    id: 'dock',
    nameVi: 'Vòng Xuyến Trung Tâm (Central Dock)',
    nameEn: 'Central Roundabout Dock',
    tag: 'HUB 01',
    description: 'Vòng xoay giao lộ trung tâm kết nối 4 phân khu thử nghiệm robot tự hành.',
    spawnPos: { x: 0, y: 0, z: 0, heading: 0 },
    color: '#10b981',
  },
  {
    id: 'city',
    nameVi: 'Sa Hình Đô Thị Thông Minh (Smart City)',
    nameEn: 'Autonomous Smart City',
    tag: 'ZONE A',
    description: 'Hạ tầng giao thông đô thị với biển báo STOP, vạch qua đường, đèn giao thông và đèn đường.',
    spawnPos: { x: 14, y: 0, z: 14, heading: 0 },
    color: '#38bdf8',
  },
  {
    id: 'warehouse',
    nameVi: 'Kho Vận & Logistics AGV (Smart Warehouse)',
    nameEn: 'Logistics AGV Warehouse',
    tag: 'ZONE B',
    description: 'Khu kho hàng công nghiệp với kệ pallet hàng tầng, thùng phuy, vạch kẻ line dẫn hướng AGV.',
    spawnPos: { x: -17.5, y: 0, z: 9.2, heading: Math.PI / 2 },
    color: '#f59e0b',
  },
  {
    id: 'track',
    nameVi: 'Đường Đua Tốc Độ CMU (Race Loop)',
    nameEn: 'CMU High-Speed Track',
    tag: 'ZONE C',
    description: 'Sa hình đường đua tốc độ cao với gờ giảm tốc kerb thể thao và đường bám làn quang học.',
    spawnPos: { x: 15, y: 0, z: -8.5, heading: Math.PI / 2 },
    color: '#ec4899',
  },
  {
    id: 'maze',
    nameVi: 'Mê Cung Định Vị SLAM (Labyrinth Maze)',
    nameEn: 'SLAM Labyrinth Maze',
    tag: 'ZONE D',
    description: 'Hệ thống vách ngăn mê cung phức tạp để kiểm tra thuật toán vẽ bản đồ LiDAR và định vị AMCL.',
    spawnPos: { x: -14, y: 0, z: -14, heading: -Math.PI / 2 },
    color: '#8b5cf6',
  },
];

export interface ArenaEnvironmentRefs {
  obstacles: ObstacleObject[];
  shadowPlane: THREE.Mesh;
  updateShadowPosition: (pos: THREE.Vector3) => void;
  updateEnvironment: (dt: number) => void;
  setTheme: (theme: EnvironmentTheme) => void;
  arenaSize: number;
}

function seededRand(seed: number): number {
  const x = Math.sin(seed * 19.31 + 47.17) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generates tileable asphalt & concrete micro-aggregate bump + roughness maps
 * so large floor expanses break up specular reflections realistically.
 */
function createGroundMicroMaps(anisotropy: number) {
  const size = 512;
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

  for (let i = 0; i < size * size; i++) {
    const n1 = seededRand(i * 1.13);
    const n2 = seededRand(i * 7.91);
    const pebble = n1 > 0.92 ? 220 : n1 < 0.08 ? 45 : 118 + (n2 - 0.5) * 44;
    const rough = Math.max(150, Math.min(255, 205 + (n2 - 0.5) * 45));

    const idx = i * 4;
    bImg.data[idx] = pebble;
    bImg.data[idx + 1] = pebble;
    bImg.data[idx + 2] = pebble;
    bImg.data[idx + 3] = 255;

    rImg.data[idx] = rough;
    rImg.data[idx + 1] = rough;
    rImg.data[idx + 2] = rough;
    rImg.data[idx + 3] = 255;
  }

  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(22, 22);
  bumpMap.anisotropy = anisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(22, 22);
  roughnessMap.anisotropy = anisotropy;

  return { bumpMap, roughnessMap };
}

/**
 * Generates high-contrast printed traffic sign textures ("STOP", "30", "!", Arrow).
 */
function createTrafficSignTexture(type: 'stop' | 'speed30' | 'turn' | 'warning', anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (type === 'stop') {
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.beginPath();
    const cx = size / 2;
    const cy = size / 2;
    const R = 108;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STOP', cx, cy + 4);
  } else if (type === 'speed30') {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 108, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 94px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('30', size / 2, size / 2 + 4);
  } else if (type === 'warning') {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, size - 36, size - 36);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 124px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', size / 2, size / 2 + 8);
  } else {
    ctx.fillStyle = '#eab308';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, size - 36, size - 36);

    // Curved turn arrow
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(size * 0.35, size * 0.72);
    ctx.lineTo(size * 0.35, size * 0.45);
    ctx.quadraticCurveTo(size * 0.35, size * 0.3, size * 0.65, size * 0.3);
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(size * 0.74, size * 0.3);
    ctx.lineTo(size * 0.56, size * 0.18);
    ctx.lineTo(size * 0.56, size * 0.42);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

/**
 * Generates corrugated cardboard cargo crate texture with shipping stencils.
 */
function createCrateTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#a1622a';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle fiber streaks
  ctx.fillStyle = 'rgba(72, 40, 14, 0.14)';
  for (let y = 0; y < 256; y += 6) {
    ctx.fillRect(0, y, 256, 2);
  }

  // Packing tape strip & frame
  ctx.fillStyle = '#d4a373';
  ctx.fillRect(108, 0, 40, 256);
  ctx.strokeStyle = '#6f421a';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 248);

  // Cargo stencil
  ctx.fillStyle = '#3f2209';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('AGV CARGO', 16, 46);
  ctx.font = '14px monospace';
  ctx.fillText('CMU LAB #10A', 16, 228);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export function buildArenaEnvironment(
  scene: THREE.Scene,
  options: { maxAnisotropy?: number } = {}
): ArenaEnvironmentRefs {
  const anisotropy = options.maxAnisotropy ?? 4;
  const obstacles: ObstacleObject[] = [];

  // =========================================================================
  // 1. PROCEDURAL 60m x 60m ASPHALT / LAB EPOXY GROUND TEXTURE + MICRO MAPS
  // =========================================================================
  const canvasSize = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d')!;

  const toPx = (m: number) => ((m + ARENA_HALF_SIZE) / (ARENA_HALF_SIZE * 2)) * canvasSize;
  const toScale = (m: number) => (m / (ARENA_HALF_SIZE * 2)) * canvasSize;

  // Base weathered dark concrete/asphalt deck
  ctx.fillStyle = '#121722';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  const qLeft = toPx(-ARENA_HALF_SIZE);
  const qCenter = toPx(0);

  // Warehouse (Top-Left: X < 0, Z > 0) -> Industrial Sealed Slate-Green Epoxy
  ctx.fillStyle = '#13202b';
  ctx.fillRect(qLeft, qCenter, toScale(ARENA_HALF_SIZE), toScale(ARENA_HALF_SIZE));

  // SLAM Maze (Bottom-Left: X < 0, Z < 0) -> Matte Dark Concrete Lab Slab
  ctx.fillStyle = '#101521';
  ctx.fillRect(qLeft, 0, toScale(ARENA_HALF_SIZE), toScale(ARENA_HALF_SIZE));

  // Concrete expansion joint grid (every 2m)
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.22)';
  ctx.lineWidth = 1.5;
  const gridStep = toScale(2.0);
  for (let x = 0; x <= canvasSize; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasSize);
    ctx.stroke();
  }
  for (let y = 0; y <= canvasSize; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasSize, y);
    ctx.stroke();
  }

  // Subtle asphalt oil/tire wear patches across proving grounds
  for (let i = 0; i < 65; i++) {
    const px = seededRand(i * 5.3) * canvasSize;
    const py = seededRand(i * 9.7) * canvasSize;
    const rad = 24 + seededRand(i * 13.1) * 90;
    const grad = ctx.createRadialGradient(px, py, 2, px, py, rad);
    grad.addColorStop(0, 'rgba(8, 11, 18, 0.24)');
    grad.addColorStop(1, 'rgba(8, 11, 18, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Calibration coordinate markers
  ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';
  ctx.font = 'bold 16px monospace';
  for (let m = -20; m <= 20; m += 10) {
    if (m === 0) continue;
    ctx.fillText(`${m > 0 ? '+' : ''}${m}m`, toPx(m) - 15, qCenter - 10);
    ctx.fillText(`${m > 0 ? '+' : ''}${m}m`, qCenter + 10, toPx(m) + 5);
  }

  // =========================================================================
  // 2. CENTRAL CROSSROAD AVENUES & TEXTURED ROUNDABOUT
  // =========================================================================
  const roadWidth = toScale(7.5);
  const halfRoad = roadWidth / 2;

  ctx.fillStyle = '#1b2230';
  ctx.fillRect(0, qCenter - halfRoad, canvasSize, roadWidth);
  ctx.fillRect(qCenter - halfRoad, 0, roadWidth, canvasSize);

  // Subtle worn wheel-path tracks along avenues
  ctx.strokeStyle = 'rgba(10, 14, 22, 0.32)';
  ctx.lineWidth = toScale(1.1);
  [-1.7, 1.7].forEach((laneOff) => {
    ctx.beginPath();
    ctx.moveTo(0, qCenter + toScale(laneOff));
    ctx.lineTo(canvasSize, qCenter + toScale(laneOff));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(qCenter + toScale(laneOff), 0);
    ctx.lineTo(qCenter + toScale(laneOff), canvasSize);
    ctx.stroke();
  });

  // Slightly weathered painted road edge lines
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, qCenter - halfRoad, canvasSize, roadWidth);
  ctx.strokeRect(qCenter - halfRoad, 0, roadWidth, canvasSize);

  // Road Center Dashed Yellow Dividers
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 4;
  ctx.setLineDash([24, 16]);
  ctx.beginPath();
  ctx.moveTo(0, qCenter);
  ctx.lineTo(canvasSize, qCenter);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(qCenter, 0);
  ctx.lineTo(qCenter, canvasSize);
  ctx.stroke();
  ctx.setLineDash([]);

  // Central Roundabout Ring (dark slate paved ring + calibrated brushed concrete hub)
  const roundRadius = toScale(5.8);
  ctx.fillStyle = '#1b2230';
  ctx.beginPath();
  ctx.arc(qCenter, qCenter, roundRadius + toScale(2.0), 0, Math.PI * 2);
  ctx.fill();

  // Outer painted roundabout yield dashes
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 14]);
  ctx.beginPath();
  ctx.arc(qCenter, qCenter, roundRadius + toScale(1.5), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Roundabout Inner Hub Plate (realistic dark brushed architectural concrete instead of bright green)
  ctx.fillStyle = '#1e2736';
  ctx.beginPath();
  ctx.arc(qCenter, qCenter, roundRadius - toScale(0.8), 0, Math.PI * 2);
  ctx.fill();

  // Subtle emerald architectural accent ring
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(qCenter, qCenter, roundRadius - toScale(0.95), 0, Math.PI * 2);
  ctx.stroke();

  // Crisp optical autonomous line-follower track ring around Central Roundabout (r = 6.1m)
  const roundaboutLineR = toScale(6.1);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = toScale(0.42);
  ctx.beginPath();
  ctx.arc(qCenter, qCenter, roundaboutLineR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = toScale(0.14);
  ctx.setLineDash([18, 12]);
  ctx.beginPath();
  ctx.arc(qCenter, qCenter, roundaboutLineR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Compass Rose in Center
  ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', qCenter, qCenter - roundRadius * 0.54);
  ctx.fillText('S', qCenter, qCenter + roundRadius * 0.54);
  ctx.fillText('E', qCenter + roundRadius * 0.54, qCenter);
  ctx.fillText('W', qCenter - roundRadius * 0.54, qCenter);
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 19px monospace';
  ctx.fillText('CMU 10A', qCenter, qCenter);

  // 3D Low-Profile Beveled Concrete Curb Ring around Roundabout Island (Y-up chamfered edge)
  const islandCurb = new THREE.Mesh(
    new THREE.TorusGeometry(5.0, 0.08, 10, 64),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.82, metalness: 0.1, envMapIntensity: 0.2 })
  );
  islandCurb.rotation.x = Math.PI / 2;
  islandCurb.position.y = 0.025;
  islandCurb.receiveShadow = true;
  scene.add(islandCurb);

  // =========================================================================
  // 3. ZONE A: SMART CITY STREET MARKINGS
  // =========================================================================
  function drawZebraCrossing(cx: number, cy: number, isVertical: boolean) {
    ctx.fillStyle = '#dce3ec';
    const numStripes = 8;
    const stripeW = isVertical ? toScale(0.6) : toScale(3.2);
    const stripeH = isVertical ? toScale(3.2) : toScale(0.6);
    const spacing = toScale(0.8);

    for (let i = 0; i < numStripes; i++) {
      const offset = (i - numStripes / 2) * spacing;
      if (isVertical) {
        ctx.fillRect(cx + offset, cy - stripeH / 2, stripeW, stripeH);
      } else {
        ctx.fillRect(cx - stripeW / 2, cy + offset, stripeW, stripeH);
      }
    }
  }

  drawZebraCrossing(qCenter + toScale(8.5), qCenter, true);
  drawZebraCrossing(qCenter, qCenter + toScale(8.5), false);
  drawZebraCrossing(qCenter - toScale(8.5), qCenter, true);
  drawZebraCrossing(qCenter, qCenter - toScale(8.5), false);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const px = toPx(10 + i * 3.5);
    const py = toPx(18);
    ctx.strokeRect(px, py, toScale(3.0), toScale(5.5));
    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.fillRect(px, py, toScale(3.0), toScale(5.5));
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`P-${i + 1}`, px + toScale(1.5), py + toScale(2.8));
  }

  // =========================================================================
  // 4. ZONE B: SMART WAREHOUSE FLOOR MARKINGS
  // =========================================================================
  const whX = toPx(-24);
  const whY = toPx(8);
  const whW = toScale(18);
  const whH = toScale(18);

  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 6;
  ctx.strokeRect(whX, whY, whW, whH);

  // Rounded cyan AGV optical guidance track (x: -24.5..-11.0, z: 9.2..18.2, r = 2.0m) matching robot Pure Pursuit path
  const agvX = toPx(-24.5);
  const agvY = toPx(9.2);
  const agvW = toScale(13.5);
  const agvH = toScale(9.0);
  const agvR = toScale(2.0);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = toScale(0.62);
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(agvX, agvY, agvW, agvH, agvR);
  } else {
    ctx.rect(agvX, agvY, agvW, agvH);
  }
  ctx.stroke();

  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = toScale(0.24);
  ctx.setLineDash([20, 10]);
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(agvX, agvY, agvW, agvH, agvR);
  } else {
    ctx.rect(agvX, agvY, agvW, agvH);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('DOCK 01 - AGV INBOUND', whX + toScale(5), whY + toScale(2));
  ctx.fillText('DOCK 02 - OUTBOUND', whX + toScale(5), whY + whH - toScale(2));

  // =========================================================================
  // 5. ZONE C: CMU RACE TRACK OVAL & CHICANE
  // =========================================================================
  const trackCenterX = toPx(15);
  const trackCenterY = toPx(-15);
  const trackR1 = toScale(9.5);
  const trackR2 = toScale(6.5);

  ctx.strokeStyle = '#1b2230';
  ctx.lineWidth = toScale(4.8);
  ctx.beginPath();
  ctx.ellipse(trackCenterX, trackCenterY, trackR1, trackR2, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = toScale(1.1);
  ctx.beginPath();
  ctx.ellipse(trackCenterX, trackCenterY, trackR1, trackR2, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#020617';
  ctx.lineWidth = toScale(0.45);
  ctx.beginPath();
  ctx.ellipse(trackCenterX, trackCenterY, trackR1, trackR2, 0, 0, Math.PI * 2);
  ctx.stroke();

  const kerbRadius = trackR1 + toScale(2.6);
  const kerbSegments = 36;
  for (let i = 0; i < kerbSegments; i++) {
    const a1 = (i / kerbSegments) * Math.PI * 2;
    const a2 = ((i + 1) / kerbSegments) * Math.PI * 2;
    ctx.strokeStyle = i % 2 === 0 ? '#dc2626' : '#e2e8f0';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(trackCenterX, trackCenterY, kerbRadius, a1, a2);
    ctx.stroke();
  }

  const finishX = trackCenterX;
  const finishY = trackCenterY + trackR2;
  const fBoxW = toScale(0.5);
  const fBoxH = toScale(0.5);
  for (let r = 0; r < 2; r++) {
    for (let c = -4; c < 4; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f1f5f9' : '#090d16';
      ctx.fillRect(finishX + c * fBoxW, finishY - toScale(2.4) + r * fBoxH, fBoxW, fBoxH);
    }
  }

  ctx.fillStyle = '#ec4899';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('CMU AUTONOMOUS PROVING GROUND', trackCenterX, trackCenterY - toScale(1.5));
  ctx.font = '16px monospace';
  ctx.fillText('LINE-FOLLOWER AI BENCHMARK 200 RPM', trackCenterX, trackCenterY + toScale(1.5));

  // =========================================================================
  // 6. ZONE D: SLAM LABYRINTH CORRIDOR GRID MARKINGS
  // =========================================================================
  const mazeX = toPx(-24);
  const mazeY = toPx(-24);
  const mazeW = toScale(18);
  const mazeH = toScale(18);

  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 4;
  ctx.strokeRect(mazeX, mazeY, mazeW, mazeH);

  const waypoints = [
    { x: toPx(-20), y: toPx(-20), name: 'WP-1' },
    { x: toPx(-10), y: toPx(-20), name: 'WP-2' },
    { x: toPx(-10), y: toPx(-10), name: 'WP-3' },
    { x: toPx(-20), y: toPx(-10), name: 'WP-4' },
  ];
  for (const wp of waypoints) {
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wp.x, wp.y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
    ctx.fill();
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(wp.name, wp.x, wp.y);
  }

  const floorTexture = new THREE.CanvasTexture(canvas);
  floorTexture.wrapS = THREE.ClampToEdgeWrapping;
  floorTexture.wrapT = THREE.ClampToEdgeWrapping;
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.generateMipmaps = true;
  floorTexture.anisotropy = anisotropy;

  const groundMicro = createGroundMicroMaps(anisotropy);
  const floorGeo = new THREE.PlaneGeometry(ARENA_HALF_SIZE * 2, ARENA_HALF_SIZE * 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    bumpMap: groundMicro.bumpMap,
    bumpScale: 0.015,
    roughnessMap: groundMicro.roughnessMap,
    roughness: 0.88,
    metalness: 0.04,
    envMapIntensity: 0.14,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Extended Outer Horizon Apron so arena blends naturally into fog instead of floating slab
  const outerApronMat = new THREE.MeshStandardMaterial({
    color: 0x0b101b,
    roughness: 0.94,
    metalness: 0.04,
    envMapIntensity: 0.08,
  });
  const outerApron = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), outerApronMat);
  outerApron.rotation.x = -Math.PI / 2;
  outerApron.position.y = -0.02;
  outerApron.receiveShadow = true;
  scene.add(outerApron);

  // =========================================================================
  // 7. BOUNDARY WALLS & REFLECTIVE CURBS (±29m)
  // =========================================================================
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x161f30,
    roughness: 0.82,
    metalness: 0.14,
  });
  const curbHazardMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.48,
    metalness: 0.2,
  });

  function createOuterWall(w: number, h: number, d: number, x: number, y: number, z: number) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    obstacles.push({
      mesh: wall,
      type: 'wall',
      label: 'Tường Ranh Giới Khu Thử Nghiệm 60m',
      radius: Math.max(w, d) / 2,
      position: wall.position,
      halfSize: new THREE.Vector3(w / 2, h / 2, d / 2),
    });
  }

  const fullW = ARENA_HALF_SIZE * 2;
  const wallH = 1.2;
  const wallThick = 0.6;
  createOuterWall(fullW, wallH, wallThick, 0, wallH / 2, ARENA_HALF_SIZE);
  createOuterWall(fullW, wallH, wallThick, 0, wallH / 2, -ARENA_HALF_SIZE);
  createOuterWall(wallThick, wallH, fullW, ARENA_HALF_SIZE, wallH / 2, 0);
  createOuterWall(wallThick, wallH, fullW, -ARENA_HALF_SIZE, wallH / 2, 0);

  const curbNorth = new THREE.Mesh(new THREE.BoxGeometry(fullW - 1, 0.14, 0.36), curbHazardMat);
  curbNorth.position.set(0, 0.07, ARENA_HALF_SIZE - 0.42);
  scene.add(curbNorth);

  const curbSouth = new THREE.Mesh(new THREE.BoxGeometry(fullW - 1, 0.14, 0.36), curbHazardMat);
  curbSouth.position.set(0, 0.07, -ARENA_HALF_SIZE + 0.42);
  scene.add(curbSouth);

  const curbEast = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, fullW - 1), curbHazardMat);
  curbEast.position.set(ARENA_HALF_SIZE - 0.42, 0.07, 0);
  scene.add(curbEast);

  const curbWest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, fullW - 1), curbHazardMat);
  curbWest.position.set(-ARENA_HALF_SIZE + 0.42, 0.07, 0);
  scene.add(curbWest);

  // =========================================================================
  // 8. DETAILED 3D PROPS GENERATORS
  // =========================================================================
  const streetLightList: THREE.Light[] = [];
  const trafficLightLenses: { red: THREE.Mesh; yellow: THREE.Mesh; green: THREE.Mesh; timer: number }[] = [];
  const crateTex = createCrateTexture(anisotropy);
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, color: 0xffffff, roughness: 0.85, metalness: 0.04 });

  function createStreetLamp(x: number, z: number, rotationY = 0) {
    const lampGroup = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.82, roughness: 0.3 });

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.24, 16), poleMat);
    plinth.position.y = 0.12;
    lampGroup.add(plinth);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 4.1, 16), poleMat);
    pole.position.y = 2.15;
    pole.castShadow = true;
    lampGroup.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.075, 0.075), poleMat);
    arm.position.set(0.5, 4.15, 0);
    lampGroup.add(arm);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.28), poleMat);
    hood.position.set(1.0, 4.1, 0);
    lampGroup.add(hood);

    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), new THREE.MeshBasicMaterial({ color: 0xfffaed }));
    led.rotation.x = Math.PI / 2;
    led.position.set(1.0, 4.04, 0);
    lampGroup.add(led);

    const spot = new THREE.SpotLight(0xfffaed, 2.2, 16, Math.PI / 4, 0.45, 1.2);
    spot.position.set(1.0, 4.0, 0);
    spot.target.position.set(1.0, 0, 0);
    lampGroup.add(spot);
    lampGroup.add(spot.target);
    streetLightList.push(spot);

    lampGroup.position.set(x, 0, z);
    lampGroup.rotation.y = rotationY;
    scene.add(lampGroup);

    obstacles.push({
      mesh: lampGroup,
      type: 'sign',
      label: 'Cột Đèn Chiếu Sáng Đô Thị (Streetlamp)',
      radius: 0.35,
      position: new THREE.Vector3(x, 0, z),
    });
  }

  function createTrafficLight(x: number, z: number, rotationY = 0) {
    const tlGroup = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.78, roughness: 0.32 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 16), poleMat);
    pole.position.y = 1.6;
    pole.castShadow = true;
    tlGroup.add(pole);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.98, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.52, metalness: 0.2 })
    );
    box.position.set(0, 2.9, 0);
    box.castShadow = true;
    tlGroup.add(box);

    const lensGeo = new THREE.SphereGeometry(0.082, 16, 16);
    const matRed = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 });
    const matYellow = new THREE.MeshStandardMaterial({ color: 0x78350f, emissive: 0xf59e0b, emissiveIntensity: 0 });
    const matGreen = new THREE.MeshStandardMaterial({ color: 0x064e3b, emissive: 0x22c55e, emissiveIntensity: 0 });

    const redLens = new THREE.Mesh(lensGeo, matRed);
    redLens.position.set(0, 3.2, 0.15);
    tlGroup.add(redLens);

    const yellowLens = new THREE.Mesh(lensGeo, matYellow);
    yellowLens.position.set(0, 2.9, 0.15);
    tlGroup.add(yellowLens);

    const greenLens = new THREE.Mesh(lensGeo, matGreen);
    greenLens.position.set(0, 2.6, 0.15);
    tlGroup.add(greenLens);

    trafficLightLenses.push({ red: redLens, yellow: yellowLens, green: greenLens, timer: Math.random() * 8 });

    tlGroup.position.set(x, 0, z);
    tlGroup.rotation.y = rotationY;
    scene.add(tlGroup);

    obstacles.push({
      mesh: tlGroup,
      type: 'sign',
      label: 'Cột Đèn Tín Hiệu Giao Thông (Traffic Light)',
      radius: 0.4,
      position: new THREE.Vector3(x, 0, z),
    });
  }

  function createTrafficSign(x: number, z: number, type: 'stop' | 'speed30' | 'turn' | 'warning', rotationY = 0) {
    const signGroup = new THREE.Group();
    const metalPole = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.26 });

    const poleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 14), metalPole);
    poleBase.position.y = 0.06;
    signGroup.add(poleBase);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, 2.4, 12), metalPole);
    pole.position.y = 1.2;
    pole.castShadow = true;
    signGroup.add(pole);

    const faceTex = createTrafficSignTexture(type, anisotropy);
    const backMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.35 });
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, color: 0xffffff, roughness: 0.38, metalness: 0.08 });

    let signPlate: THREE.Mesh;
    if (type === 'stop') {
      const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.024, 8);
      geo.rotateX(Math.PI / 2);
      signPlate = new THREE.Mesh(geo, [backMat, faceMat, backMat]);
    } else if (type === 'speed30') {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.024, 32);
      geo.rotateX(Math.PI / 2);
      signPlate = new THREE.Mesh(geo, [backMat, faceMat, backMat]);
    } else {
      const geo = new THREE.BoxGeometry(0.6, 0.6, 0.024);
      signPlate = new THREE.Mesh(geo, [backMat, backMat, backMat, backMat, faceMat, backMat]);
      signPlate.rotation.z = Math.PI / 4;
    }

    signPlate.position.set(0, 2.2, 0.03);
    signPlate.castShadow = true;
    signGroup.add(signPlate);

    signGroup.position.set(x, 0, z);
    signGroup.rotation.y = rotationY;
    scene.add(signGroup);

    obstacles.push({
      mesh: signGroup,
      type: 'sign',
      label: `Biển Báo Giao Thông (${type.toUpperCase()})`,
      radius: 0.38,
      position: new THREE.Vector3(x, 0, z),
    });
  }

  function createWarehouseRack(x: number, z: number, rotationY = 0) {
    const rackGroup = new THREE.Group();
    const rackW = 4.2;
    const rackH = 3.6;
    const rackD = 1.4;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.72, roughness: 0.3 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.6, roughness: 0.38 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88, metalness: 0.02 });

    const postGeo = new THREE.BoxGeometry(0.11, rackH, 0.11);
    [
      [-rackW / 2, -rackD / 2],
      [rackW / 2, -rackD / 2],
      [-rackW / 2, rackD / 2],
      [rackW / 2, rackD / 2],
    ].forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, frameMat);
      post.position.set(px, rackH / 2, pz);
      post.castShadow = true;
      rackGroup.add(post);
    });

    const beamGeo = new THREE.BoxGeometry(rackW, 0.09, 0.08);
    [0.9, 2.0, 3.1].forEach((levelY, tierIdx) => {
      const beamFront = new THREE.Mesh(beamGeo, beamMat);
      beamFront.position.set(0, levelY, rackD / 2);
      rackGroup.add(beamFront);

      const beamBack = new THREE.Mesh(beamGeo, beamMat);
      beamBack.position.set(0, levelY, -rackD / 2);
      rackGroup.add(beamBack);

      for (let bi = -1; bi <= 1; bi++) {
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.11, 1.12), woodMat);
        pallet.position.set(bi * 1.3, levelY + 0.095, 0);
        pallet.castShadow = true;
        rackGroup.add(pallet);

        const h = 0.62 + ((tierIdx * 3 + bi + 4) % 3) * 0.1;
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.86, h, 0.86), crateMat);
        crate.position.set(bi * 1.3, levelY + 0.15 + h / 2, 0);
        crate.castShadow = true;
        rackGroup.add(crate);
      }
    });

    rackGroup.position.set(x, 0, z);
    rackGroup.rotation.y = rotationY;
    scene.add(rackGroup);

    obstacles.push({
      mesh: rackGroup,
      type: 'rack',
      label: 'Kệ Pallet Chứa Hàng Nhà Kho AGV (Heavy-Duty Rack)',
      radius: 2.2,
      position: new THREE.Vector3(x, 0, z),
      halfSize: new THREE.Vector3(rackW / 2, rackH / 2, rackD / 2),
    });
  }

  function createSteelBarrel(x: number, z: number, colorHex = 0x0284c7) {
    const barrelMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      metalness: 0.68,
      roughness: 0.34,
    });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.95, 24), barrelMat);
    barrel.position.set(x, 0.475, z);
    barrel.castShadow = true;
    barrel.receiveShadow = true;

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.84, roughness: 0.28 });
    [-0.46, -0.22, 0.22, 0.46].forEach((ry) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.018, 10, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ry;
      barrel.add(ring);
    });

    // Top bung caps
    [-0.18, 0.18].forEach((bx, idx) => {
      const bung = new THREE.Mesh(new THREE.CylinderGeometry(idx === 0 ? 0.045 : 0.03, idx === 0 ? 0.045 : 0.03, 0.03, 12), ringMat);
      bung.position.set(bx, 0.48, 0.12);
      barrel.add(bung);
    });

    scene.add(barrel);

    obstacles.push({
      mesh: barrel,
      type: 'barrel',
      label: 'Thùng Phuy Chứa Hàng Công Nghiệp (Steel Barrel)',
      radius: 0.45,
      position: new THREE.Vector3(x, 0.475, z),
    });
  }

  function createTrafficCone(x: number, z: number, label: string) {
    const coneGroup = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88, metalness: 0.04 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.07, 0.68), baseMat);
    base.position.y = 0.035;
    base.castShadow = true;
    coneGroup.add(base);

    const coneMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45, metalness: 0.05 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.27, 0.88, 24), coneMat);
    body.position.y = 0.51;
    body.castShadow = true;
    coneGroup.add(body);

    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.25,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.08,
    });
    const collar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.18, 0.16, 24), collarMat);
    collar1.position.y = 0.58;
    coneGroup.add(collar1);

    const collar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.23, 0.1, 24), collarMat);
    collar2.position.y = 0.34;
    coneGroup.add(collar2);

    coneGroup.position.set(x, 0, z);
    scene.add(coneGroup);

    obstacles.push({
      mesh: coneGroup,
      type: 'cone',
      label,
      radius: 0.45,
      position: new THREE.Vector3(x, 0, z),
    });
  }

  function createTestCube(x: number, z: number, size: number, colorHex: number, label: string) {
    const cubeMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.56,
      metalness: 0.18,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), cubeMat);
    cube.position.set(x, size / 2, z);
    cube.castShadow = true;
    cube.receiveShadow = true;

    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(size + 0.03, 0.06, size + 0.03),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.3 })
    );
    rim.position.y = size / 2 - 0.03;
    cube.add(rim);

    scene.add(cube);

    obstacles.push({
      mesh: cube,
      type: 'box',
      label,
      radius: size * 0.7,
      position: new THREE.Vector3(x, size / 2, z),
      halfSize: new THREE.Vector3(size / 2, size / 2, size / 2),
    });
  }

  function createMazeWall(x: number, z: number, length: number, isVertical: boolean) {
    const wallH = 1.1;
    const wallW = isVertical ? 0.3 : length;
    const wallD = isVertical ? length : 0.3;

    const wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(wallW, wallH, wallD),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.76, metalness: 0.18 })
    );
    wallMesh.position.set(x, wallH / 2, z);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(wallW + 0.04, 0.05, wallD + 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.3 })
    );
    cap.position.y = wallH / 2 + 0.025;
    wallMesh.add(cap);

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(wallW, 0.025, wallD),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6 })
    );
    strip.position.y = wallH / 2 + 0.055;
    wallMesh.add(strip);

    scene.add(wallMesh);

    obstacles.push({
      mesh: wallMesh,
      type: 'wall',
      label: 'Vách Ngăn Thử Nghiệm SLAM Labyrinth',
      radius: Math.max(wallW, wallD) / 2,
      position: new THREE.Vector3(x, wallH / 2, z),
      halfSize: new THREE.Vector3(wallW / 2, wallH / 2, wallD / 2),
    });
  }

  function createObstacleCup(x: number, z: number) {
    const cupGroup = new THREE.Group();
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.34, metalness: 0.08 });
    const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.75, 24), cupMat);
    cupMesh.position.y = 0.375;
    cupMesh.castShadow = true;
    cupGroup.add(cupMesh);

    const rimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.022, 12, 24), rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.75;
    cupGroup.add(rimMesh);

    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24), rimMat);
    baseRing.position.y = 0.02;
    cupGroup.add(baseRing);

    cupGroup.position.set(x, 0, z);
    scene.add(cupGroup);

    obstacles.push({
      mesh: cupGroup,
      type: 'cup',
      label: 'Cốc Chắn Vật Cản Thử Nghiệm (Obstacle Cup)',
      radius: 0.4,
      position: new THREE.Vector3(x, 0, z),
    });
  }

  // =========================================================================
  // 9. POPULATE THE 60m x 60m PROVING GROUNDS
  // =========================================================================
  createTrafficLight(6.2, 5.8, 0);
  createTrafficLight(-5.8, 6.2, Math.PI / 2);
  createTrafficLight(-6.2, -5.8, Math.PI);
  createTrafficLight(5.8, -6.2, -Math.PI / 2);

  createStreetLamp(8.5, 4.5, -Math.PI / 2);
  createStreetLamp(18.5, 4.5, -Math.PI / 2);
  createStreetLamp(4.5, 8.5, 0);
  createStreetLamp(4.5, 18.5, 0);

  createTrafficSign(7.5, 8.5, 'stop', 0);
  createTrafficSign(14.0, 4.8, 'speed30', -Math.PI / 2);
  createTrafficSign(21.0, 4.8, 'warning', -Math.PI / 2);
  createTrafficSign(4.8, 14.0, 'turn', 0);

  createTrafficCone(14.0, 11.5, 'Cọc Tiêu Làn Đường Đô Thị A');
  createTrafficCone(17.5, 11.5, 'Cọc Tiêu Làn Đường Đô Thị B');
  createObstacleCup(12.0, 15.0);

  createWarehouseRack(-14.0, 11.0, 0);
  createWarehouseRack(-14.0, 15.0, 0);
  createWarehouseRack(-21.0, 11.0, 0);
  createWarehouseRack(-21.0, 15.0, 0);

  createSteelBarrel(-8.5, 12.0, 0x0284c7);
  createSteelBarrel(-8.5, 13.2, 0x0284c7);
  createSteelBarrel(-8.5, 14.4, 0xd97706);
  createSteelBarrel(-9.7, 12.6, 0xdc2626);

  createTestCube(-18.0, 20.0, 1.2, 0x64748b, 'Khối Hàng Lưu Trữ DOCK 01');
  createTestCube(-13.0, 22.0, 1.0, 0x2563eb, 'Khối Hàng Pallet DOCK 02');

  createTrafficCone(13.5, -6.2, 'Pylon Cửa Vào Đường Đua CMU 1');
  createTrafficCone(16.5, -6.2, 'Pylon Cửa Vào Đường Đua CMU 2');
  createTrafficCone(8.0, -15.0, 'Pylon Apex Cua Trái 1');
  createTrafficCone(22.0, -15.0, 'Pylon Apex Cua Phải 2');
  createTestCube(15.0, -15.0, 1.2, 0x059669, 'Bục Tháp Trọng Tài Đường Đua CMU');

  function createTireStack(x: number, z: number) {
    const stackGroup = new THREE.Group();
    const tireMat1 = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.78 });
    const tireMat2 = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78 });
    for (let i = 0; i < 3; i++) {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.12, 12, 24),
        i % 2 === 0 ? tireMat1 : tireMat2
      );
      tire.rotation.x = Math.PI / 2;
      tire.position.y = 0.14 + i * 0.22;
      tire.castShadow = true;
      stackGroup.add(tire);
    }
    stackGroup.position.set(x, 0, z);
    scene.add(stackGroup);
    obstacles.push({
      mesh: stackGroup,
      type: 'box',
      label: 'Rào Lốp An Toàn Đường Đua (Tire Barrier)',
      radius: 0.5,
      position: new THREE.Vector3(x, 0, z),
    });
  }
  createTireStack(27.2, -15.0);
  createTireStack(27.2, -16.2);
  createTireStack(27.2, -13.8);

  createMazeWall(-15.0, -8.0, 12.0, false);
  createMazeWall(-21.0, -14.0, 12.0, true);
  createMazeWall(-15.0, -20.0, 12.0, false);
  createMazeWall(-9.0, -14.0, 12.0, true);
  createMazeWall(-17.0, -11.0, 6.0, false);
  createMazeWall(-13.0, -17.0, 6.0, false);
  createMazeWall(-15.0, -14.0, 5.0, true);

  createTrafficCone(-18.5, -18.5, 'Cọc Tiêu Đánh Dấu SLAM Waypoint 1');
  createTrafficCone(-11.5, -18.5, 'Cọc Tiêu Đánh Dấu SLAM Waypoint 2');
  createObstacleCup(-11.5, -11.5);
  createTestCube(-18.5, -11.5, 0.8, 0x7c3aed, 'Khối Kiểm Tra Điểm Mốc SLAM');

  createObstacleCup(0, 3.8);
  createTrafficCone(-3.2, 2.8, 'Cọc Tiêu Vòng Xuyến Tây Bắc');
  createTrafficCone(3.2, 2.8, 'Cọc Tiêu Vòng Xuyến Đông Bắc');

  // =========================================================================
  // 10. SOFT CONTACT SHADOW FOR JETBOT
  // =========================================================================
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d')!;
  const gradient = sCtx.createRadialGradient(128, 128, 22, 128, 128, 118);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.86)');
  gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sCtx.fillStyle = gradient;
  sCtx.fillRect(0, 0, 256, 256);

  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 2.7),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0, 0.005, 0);
  scene.add(shadowPlane);

  const updateShadowPosition = (pos: THREE.Vector3) => {
    shadowPlane.position.x = pos.x;
    shadowPlane.position.z = pos.z;
  };

  // =========================================================================
  // 11. DYNAMIC ENVIRONMENT ANIMATIONS & THEMES
  // =========================================================================
  const updateEnvironment = (dt: number) => {
    trafficLightLenses.forEach((tl) => {
      tl.timer = (tl.timer + dt) % 9.5;
      const t = tl.timer;
      if (t < 4.0) {
        (tl.red.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2;
        (tl.yellow.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        (tl.green.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
      } else if (t < 8.0) {
        (tl.red.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        (tl.yellow.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        (tl.green.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2;
      } else {
        (tl.red.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        (tl.yellow.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2;
        (tl.green.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
      }
    });
  };

  const setTheme = (theme: EnvironmentTheme) => {
    if (theme === 'night_drive') {
      scene.background = new THREE.Color(0x030712);
      if (scene.fog) {
        scene.fog.color = new THREE.Color(0x030712);
        (scene.fog as THREE.FogExp2).density = 0.022;
      }
      outerApronMat.color.setHex(0x040711);
      streetLightList.forEach((light) => (light.intensity = 3.8));
    } else if (theme === 'daylight_city') {
      scene.background = new THREE.Color(0x93c5fd);
      if (scene.fog) {
        scene.fog.color = new THREE.Color(0x93c5fd);
        (scene.fog as THREE.FogExp2).density = 0.008;
      }
      outerApronMat.color.setHex(0x1e293b);
      streetLightList.forEach((light) => (light.intensity = 0.4));
    } else {
      scene.background = new THREE.Color(0x0a0f1d);
      if (scene.fog) {
        scene.fog.color = new THREE.Color(0x0a0f1d);
        (scene.fog as THREE.FogExp2).density = 0.017;
      }
      outerApronMat.color.setHex(0x0b101b);
      streetLightList.forEach((light) => (light.intensity = 2.0));
    }
  };

  return {
    obstacles,
    shadowPlane,
    updateShadowPosition,
    updateEnvironment,
    setTheme,
    arenaSize: ARENA_HALF_SIZE * 2,
  };
}

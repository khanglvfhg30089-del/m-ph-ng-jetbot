/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WeatherType } from '../types/jetbot';

export const ARENA_HALF_SIZE = 60.0; // 120m x 120m expanded proving ground
export const ARENA_SAFE_BOUND = 58.6;

export interface ElevationRampSpec {
  id: string;
  label: string;
  centerX: number;
  centerZ: number;
  halfWidth: number;
  halfLength: number;
  peakHeight: number;
  axis: 'x' | 'z'; // direction of travel up/down the ramp
}

export const ELEVATION_RAMPS: ElevationRampSpec[] = [
  {
    id: 'north_ramp',
    label: 'Cầu Dốc Kiểm Tra Độ Dốc Bắc (North Calibration Ramp)',
    centerX: 0,
    centerZ: 22.0,
    halfWidth: 2.3,
    halfLength: 5.0,
    peakHeight: 0.42,
    axis: 'z',
  },
  {
    id: 'west_ramp',
    label: 'Gờ Dốc Hấp Thụ Xung Lực Tây (West Suspension Bridge)',
    centerX: -22.0,
    centerZ: 0,
    halfWidth: 5.0,
    halfLength: 2.3,
    peakHeight: 0.36,
    axis: 'x',
  },
  {
    id: 'race_crest',
    label: 'Đồi Tốc Độ Đường Đua CMU (East Track Crest)',
    centerX: 48.0,
    centerZ: -30.0,
    halfWidth: 2.4,
    halfLength: 5.2,
    peakHeight: 0.38,
    axis: 'z',
  },
];

/**
 * Computes exact ground height Y and forward slope pitch angle (radians)
 * at any arena coordinate (x, z) across flat pavement and 3D calibration ramps.
 */
export function getTerrainElevationAt(
  x: number,
  z: number,
  headingRad = 0
): { y: number; pitchRad: number; onRampId: string | null } {
  let y = 0;
  let gradX = 0;
  let gradZ = 0;
  let onRampId: string | null = null;

  for (const r of ELEVATION_RAMPS) {
    const dx = x - r.centerX;
    const dz = z - r.centerZ;
    if (Math.abs(dx) <= r.halfWidth && Math.abs(dz) <= r.halfLength) {
      const along = r.axis === 'z' ? dz : dx;
      const halfSpan = r.axis === 'z' ? r.halfLength : r.halfWidth;
      const t = along / halfSpan; // -1 to +1
      // Smooth raised cosine profile: 0 at edges, peakHeight at t=0
      const phase = (t + 1) * Math.PI * 0.5; // 0 .. PI
      const h = Math.sin(phase);
      const val = r.peakHeight * h * h;
      if (val > y) {
        y = val;
        onRampId = r.id;
        // d/du [peak * sin^2(phase)] = peak * sin(2*phase) * (PI / (2 * halfSpan))
        const slope = r.peakHeight * Math.sin(2 * phase) * (Math.PI / (2 * halfSpan));
        if (r.axis === 'z') {
          gradZ = slope;
          gradX = 0;
        } else {
          gradX = slope;
          gradZ = 0;
        }
      }
    }
  }

  // Project ground gradient onto robot forward vector (sin heading, cos heading)
  const fwdSlope = Math.sin(headingRad) * gradX + Math.cos(headingRad) * gradZ;
  // Nose pitches UP (negative rotation.x in Three.js) when climbing positive slope
  const pitchRad = Math.abs(fwdSlope) < 1e-6 ? 0 : -Math.atan(fwdSlope);

  return { y, pitchRad, onRampId };
}

/**
 * 5D weather & surface physics modifiers affecting tire grip, speed scaling, and crosswind drift.
 */
export function compute5DWeatherPhysics(weather: WeatherType): {
  gripPercent: number;
  tractionMultiplier: number;
  angularDampingMultiplier: number;
  windDriftX: number;
  windDriftZ: number;
} {
  if (weather === 'rain') {
    return {
      gripPercent: 74,
      tractionMultiplier: 0.91,
      angularDampingMultiplier: 1.09, // slightly looser steering on wet asphalt
      windDriftX: 0,
      windDriftZ: 0,
    };
  }
  if (weather === 'wind_dust') {
    return {
      gripPercent: 92,
      tractionMultiplier: 0.97,
      angularDampingMultiplier: 1.02,
      windDriftX: 0.045,
      windDriftZ: 0.018,
    };
  }
  return {
    gripPercent: 99,
    tractionMultiplier: 1.0,
    angularDampingMultiplier: 1.0,
    windDriftX: 0,
    windDriftZ: 0,
  };
}

export const JETBOT_SPECS = {
  wheelBase: 0.14, // distance between left and right wheels in meters (140mm)
  wheelRadius: 0.0325, // wheel radius in meters (65mm diameter)
  maxRpm: 200, // max motor RPM at 12V
  maxSpeedMs: 0.68, // max linear velocity (~0.68 m/s)
  safeObstacleDistance: 0.8, // safe stop/turn threshold in meters
  dangerObstacleDistance: 0.35, // emergency stop threshold in meters
};

/**
 * Calculates linear and angular velocity from left and right motor RPM.
 * Differential drive forward kinematics.
 */
export function computeDifferentialKinematics(
  leftRpm: number,
  rightRpm: number,
  wheelRadius = JETBOT_SPECS.wheelRadius,
  wheelBase = JETBOT_SPECS.wheelBase
) {
  const vLeft = ((leftRpm * 2 * Math.PI) / 60) * wheelRadius;
  const vRight = ((rightRpm * 2 * Math.PI) / 60) * wheelRadius;

  const linearVelocity = (vRight + vLeft) / 2;
  const angularVelocity = (vRight - vLeft) / wheelBase;

  return {
    linearVelocity,
    angularVelocity,
    vLeft,
    vRight,
  };
}

/**
 * Computes motor RPMs from linear and angular velocity commands.
 * Inverse kinematics for differential drive.
 */
export function computeInverseKinematics(
  linearVelocity: number,
  angularVelocity: number,
  wheelRadius = JETBOT_SPECS.wheelRadius,
  wheelBase = JETBOT_SPECS.wheelBase
) {
  const vLeft = linearVelocity - (angularVelocity * wheelBase) / 2;
  const vRight = linearVelocity + (angularVelocity * wheelBase) / 2;

  const leftRpm = (vLeft / (2 * Math.PI * wheelRadius)) * 60;
  const rightRpm = (vRight / (2 * Math.PI * wheelRadius)) * 60;

  return {
    leftRpm: Math.max(-JETBOT_SPECS.maxRpm, Math.min(JETBOT_SPECS.maxRpm, leftRpm)),
    rightRpm: Math.max(-JETBOT_SPECS.maxRpm, Math.min(JETBOT_SPECS.maxRpm, rightRpm)),
  };
}

export interface DriveInputs {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export const HARMONIZED_SPECS = {
  maxLinearSpeed: 3.1, // arena m/s at 100% speed (calibrated for expanded 120m proving ground)
  maxAngularSpeed: 2.55, // rad/s (~146 deg/s) at 100% speed
  effectiveWheelBase: 1.68, // distance between left and right wheel centers in arena units
  effectiveWheelRadius: 0.38, // wheel radius in arena units
};

/**
 * Computes harmonized linear and angular velocity so forward motion and
 * steering turns are mutually compatible, smooth, and realistic.
 */
export function computeHarmonizedDrive(
  inputs: DriveInputs,
  speedPercent: number
): {
  linearVelocity: number;
  angularVelocity: number;
  leftRpm: number;
  rightRpm: number;
} {
  const speedScale = Math.max(0.1, Math.min(1.0, speedPercent / 100));
  const baseLinear = HARMONIZED_SPECS.maxLinearSpeed * speedScale;
  const baseAngular = HARMONIZED_SPECS.maxAngularSpeed * speedScale;

  let linear = 0;
  let angular = 0;

  if (inputs.forward && !inputs.backward) {
    linear = baseLinear;
  } else if (inputs.backward && !inputs.forward) {
    linear = -baseLinear * 0.75; // reverse slightly slower
  }

  // Steering:
  // In Three.js with robot facing +Z:
  // - Turning RIGHT turns towards -X (decreasing heading, angular < 0; left wheel spins faster)
  // - Turning LEFT turns towards +X (increasing heading, angular > 0; right wheel spins faster)
  if (inputs.left && !inputs.right) {
    angular = linear !== 0 ? baseAngular * 0.75 : baseAngular;
  } else if (inputs.right && !inputs.left) {
    angular = linear !== 0 ? -baseAngular * 0.75 : -baseAngular;
  }

  const halfBase = HARMONIZED_SPECS.effectiveWheelBase / 2;
  const vLeft = linear - angular * halfBase;
  const vRight = linear + angular * halfBase;

  const leftRpm = Math.round((vLeft / HARMONIZED_SPECS.maxLinearSpeed) * (speedScale * 180));
  const rightRpm = Math.round((vRight / HARMONIZED_SPECS.maxLinearSpeed) * (speedScale * 180));

  return {
    linearVelocity: linear,
    angularVelocity: angular,
    leftRpm,
    rightRpm,
  };
}

/**
 * Evaluates simulated LiDAR sector readings using Follow-The-Gap (FTG) with safety bubble
 * inflation and hysteresis turn-commit memory to navigate obstacles without oscillation.
 * Convention: angleDeg = 0 is front, positive is LEFT, negative is RIGHT.
 * steerAngle > 0 turns LEFT (heading increases), steerAngle < 0 turns RIGHT (heading decreases).
 */
export interface LidarScanPoint {
  angleDeg: number;
  distance: number; // meters from robot center
}

export interface AvoidanceMemory {
  turnBias: -1 | 0 | 1;
  backupTimer: number; // seconds remaining in committed reverse+pivot recovery
}

export interface ObstacleAvoidanceDecision {
  steerAngle: number; // -1 (hard right) to +1 (hard left)
  speedMultiplier: number; // negative = reverse
  emergencyStop: boolean;
  targetGapDeg: number;
  minFrontDist: number;
  minLeftDist: number;
  minRightDist: number;
  status: 'CLEAR' | 'CAUTIOUS' | 'AVOIDING_LEFT' | 'AVOIDING_RIGHT' | 'BACKUP_PIVOT';
  nextMemory: AvoidanceMemory;
}

export function createInitialAvoidanceMemory(): AvoidanceMemory {
  return { turnBias: 0, backupTimer: 0 };
}

export function computeObstacleAvoidanceSteering(
  scanPoints: LidarScanPoint[],
  baseSpeedPercent: number,
  memory?: AvoidanceMemory,
  dt = 0.05
): ObstacleAvoidanceDecision {
  const CRITICAL_FRONT_DIST = 1.02;
  const CAUTION_FRONT_DIST = 2.65;
  const SIDE_REPEL_DIST = 1.35;
  const GAP_OPEN_THRESHOLD = 1.45;

  let minFrontDist = Infinity;
  let minLeftDist = Infinity;
  let minRightDist = Infinity;
  let leftSum = 0;
  let leftCount = 0;
  let rightSum = 0;
  let rightCount = 0;

  const forwardPts: LidarScanPoint[] = [];

  for (const point of scanPoints) {
    const a = point.angleDeg;
    const absA = Math.abs(a);
    if (absA <= 36) {
      if (point.distance < minFrontDist) minFrontDist = point.distance;
    }
    if (a > 36 && a <= 115) {
      if (point.distance < minLeftDist) minLeftDist = point.distance;
      leftSum += Math.min(point.distance, 8.0);
      leftCount++;
    } else if (a < -36 && a >= -115) {
      if (point.distance < minRightDist) minRightDist = point.distance;
      rightSum += Math.min(point.distance, 8.0);
      rightCount++;
    }
    if (absA <= 115) {
      forwardPts.push(point);
    }
  }

  const avgLeft = leftCount > 0 ? leftSum / leftCount : minLeftDist;
  const avgRight = rightCount > 0 ? rightSum / rightCount : minRightDist;
  const prevBias = memory?.turnBias ?? 0;
  let backupTimer = Math.max(0, (memory?.backupTimer ?? 0) - dt);

  const pickTurnSide = (): -1 | 1 => {
    const scoreLeft = minLeftDist + avgLeft * 0.25 + (prevBias === 1 ? 0.35 : 0);
    const scoreRight = minRightDist + avgRight * 0.25 + (prevBias === -1 ? 0.35 : 0);
    return scoreLeft >= scoreRight ? 1 : -1;
  };

  if (minFrontDist < CRITICAL_FRONT_DIST || backupTimer > 0) {
    const isFreshEmergency = minFrontDist < CRITICAL_FRONT_DIST;
    if (isFreshEmergency && backupTimer <= 0) {
      backupTimer = 0.42;
    }
    const turnDir: -1 | 1 = prevBias !== 0 && !isFreshEmergency ? prevBias : pickTurnSide();
    const speedMult = minFrontDist < 0.85 ? -0.35 : -0.15;
    return {
      steerAngle: turnDir * 1.0,
      speedMultiplier: speedMult,
      emergencyStop: true,
      targetGapDeg: turnDir * 90,
      minFrontDist,
      minLeftDist,
      minRightDist,
      status: 'BACKUP_PIVOT',
      nextMemory: { turnBias: turnDir, backupTimer },
    };
  }

  let bestAngle = 0;
  let bestScore = -Infinity;

  for (const pt of forwardPts) {
    let effectiveClearance = Math.min(pt.distance, 7.5);
    for (const obsPt of forwardPts) {
      if (obsPt.distance < GAP_OPEN_THRESHOLD) {
        const angDiff = Math.abs(pt.angleDeg - obsPt.angleDeg);
        if (angDiff < 24) {
          const penalty = (1 - angDiff / 24) * (GAP_OPEN_THRESHOLD - obsPt.distance) * 1.8;
          effectiveClearance -= penalty;
        }
      }
    }

    const rad = (pt.angleDeg * Math.PI) / 180;
    const forwardAlignment = Math.cos(rad * 0.72);
    const biasBonus =
      prevBias !== 0 && Math.sign(pt.angleDeg) === prevBias && Math.abs(pt.angleDeg) > 10
        ? 0.25
        : 0;

    const score = effectiveClearance * (0.68 + 0.32 * forwardAlignment) + biasBonus;
    if (score > bestScore) {
      bestScore = score;
      bestAngle = pt.angleDeg;
    }
  }

  const speedScaleFactor = Math.max(0.4, Math.min(1.0, baseSpeedPercent / 100));
  if (minFrontDist < CAUTION_FRONT_DIST) {
    const closeness =
      1 -
      Math.max(
        0,
        Math.min(1, (minFrontDist - CRITICAL_FRONT_DIST) / (CAUTION_FRONT_DIST - CRITICAL_FRONT_DIST))
      );
    let steerNorm = bestAngle / 65;
    if (Math.abs(steerNorm) < 0.45) {
      steerNorm = pickTurnSide() * (0.55 + closeness * 0.35);
    }
    const clampedSteer = Math.max(-1, Math.min(1, steerNorm));
    const speedMultiplier = Math.max(0.28, 1.0 - closeness * 0.68);
    const turnBias: -1 | 1 = clampedSteer >= 0 ? 1 : -1;

    return {
      steerAngle: clampedSteer,
      speedMultiplier,
      emergencyStop: false,
      targetGapDeg: Math.round(bestAngle),
      minFrontDist,
      minLeftDist,
      minRightDist,
      status: clampedSteer >= 0 ? 'AVOIDING_LEFT' : 'AVOIDING_RIGHT',
      nextMemory: { turnBias, backupTimer: 0 },
    };
  }

  let cruiseSteer = Math.abs(bestAngle) > 12 ? (bestAngle / 95) * 0.45 : 0;
  if (minLeftDist < SIDE_REPEL_DIST) {
    cruiseSteer -= ((SIDE_REPEL_DIST - minLeftDist) / SIDE_REPEL_DIST) * 0.45;
  }
  if (minRightDist < SIDE_REPEL_DIST) {
    cruiseSteer += ((SIDE_REPEL_DIST - minRightDist) / SIDE_REPEL_DIST) * 0.45;
  }
  cruiseSteer = Math.max(-0.75, Math.min(0.75, cruiseSteer));

  const isCautious =
    minLeftDist < SIDE_REPEL_DIST ||
    minRightDist < SIDE_REPEL_DIST ||
    Math.abs(cruiseSteer) > 0.25 * speedScaleFactor;

  return {
    steerAngle: cruiseSteer,
    speedMultiplier: isCautious ? 0.85 : 1.0,
    emergencyStop: false,
    targetGapDeg: Math.round(bestAngle),
    minFrontDist,
    minLeftDist,
    minRightDist,
    status: isCautious ? 'CAUTIOUS' : 'CLEAR',
    nextMemory: { turnBias: Math.abs(cruiseSteer) > 0.15 ? (cruiseSteer > 0 ? 1 : -1) : 0, backupTimer: 0 },
  };
}

/**
 * Line follower PID steering calculation.
 */
export function computeLineFollowerCommand(
  lateralError: number,
  baseSpeedPercent: number,
  prevLateralError = lateralError,
  dt = 0.05
) {
  const kp = 0.85;
  const kd = 0.14;
  const safeDt = Math.max(0.008, dt);
  const derivative = Math.max(-4, Math.min(4, (lateralError - prevLateralError) / safeDt));
  const steer = -(lateralError * kp + derivative * kd);
  const absErr = Math.min(1.5, Math.abs(lateralError));
  const speedScale = Math.max(0.38, 1.0 - absErr * 0.52);
  const clampedSteer = Math.max(-1, Math.min(1, steer));
  return {
    steerAngle: clampedSteer,
    speedMultiplier: speedScale * Math.max(0.5, Math.min(1.0, baseSpeedPercent / 100 + 0.15)),
  };
}

export type GroundTrackKey = 'roundabout' | 'race_track' | 'warehouse_agv';

export interface TrackWaypoint {
  x: number;
  z: number;
}

function buildRoundedRectLoop(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  cornerRadius: number,
  pointsPerSide = 24
): TrackWaypoint[] {
  const r = Math.min(cornerRadius, (maxX - minX) / 2.2, (maxZ - minZ) / 2.2);
  const pts: TrackWaypoint[] = [];
  const corners = [
    { cx: maxX - r, cz: maxZ - r, startA: 0, endA: Math.PI / 2, nextEdgeStart: { x: maxX - r, z: maxZ }, nextEdgeEnd: { x: minX + r, z: maxZ } },
    { cx: minX + r, cz: maxZ - r, startA: Math.PI / 2, endA: Math.PI, nextEdgeStart: { x: minX, z: maxZ - r }, nextEdgeEnd: { x: minX, z: minZ + r } },
    { cx: minX + r, cz: minZ + r, startA: Math.PI, endA: (3 * Math.PI) / 2, nextEdgeStart: { x: minX + r, z: minZ }, nextEdgeEnd: { x: maxX - r, z: minZ } },
    { cx: maxX - r, cz: minZ + r, startA: (3 * Math.PI) / 2, endA: Math.PI * 2, nextEdgeStart: { x: maxX, z: minZ + r }, nextEdgeEnd: { x: maxX, z: maxZ - r } },
  ];
  const arcSteps = Math.max(8, Math.floor(pointsPerSide * 0.5));
  const edgeSteps = Math.max(12, pointsPerSide);
  for (const c of corners) {
    for (let i = 0; i < arcSteps; i++) {
      const a = c.startA + ((c.endA - c.startA) * i) / arcSteps;
      pts.push({ x: c.cx + Math.cos(a) * r, z: c.cz + Math.sin(a) * r });
    }
    for (let i = 0; i < edgeSteps; i++) {
      const t = i / edgeSteps;
      pts.push({
        x: c.nextEdgeStart.x + (c.nextEdgeEnd.x - c.nextEdgeStart.x) * t,
        z: c.nextEdgeStart.z + (c.nextEdgeEnd.z - c.nextEdgeStart.z) * t,
      });
    }
  }
  return pts;
}

/**
 * Ground track loops calibrated to match the expanded 120m x 120m ArenaEnvironment textures.
 */
export const GROUND_TRACK_LOOPS: Record<
  GroundTrackKey,
  { nameVi: string; waypoints: TrackWaypoint[]; spawn: { x: number; z: number; heading: number } }
> = {
  roundabout: {
    nameVi: 'Vòng Xuyến Trung Tâm',
    waypoints: Array.from({ length: 140 }, (_, i) => {
      const a = (i / 140) * Math.PI * 2;
      return { x: Math.cos(a) * 7.6, z: Math.sin(a) * 7.6 };
    }),
    spawn: { x: 0, z: 7.6, heading: Math.PI / 2 },
  },
  race_track: {
    nameVi: 'Đường Đua CMU 120m',
    waypoints: Array.from({ length: 180 }, (_, i) => {
      const a = (i / 180) * Math.PI * 2;
      return { x: 30 + Math.cos(a) * 18.0, z: -30 + Math.sin(a) * 13.0 };
    }),
    spawn: { x: 30, z: -17.0, heading: Math.PI / 2 },
  },
  warehouse_agv: {
    nameVi: 'Tuyến AGV Kho Hàng',
    waypoints: buildRoundedRectLoop(-46.0, -16.0, 16.0, 38.0, 3.5, 28),
    spawn: { x: -31.0, z: 16.0, heading: Math.PI / 2 },
  },
};

/**
 * Selects the nearest painted guidance track loop to the robot's current position.
 */
export function findNearestGroundTrack(posX: number, posZ: number): GroundTrackKey {
  let bestKey: GroundTrackKey = 'roundabout';
  let bestDistSq = Infinity;
  (Object.keys(GROUND_TRACK_LOOPS) as GroundTrackKey[]).forEach((key) => {
    for (const wp of GROUND_TRACK_LOOPS[key].waypoints) {
      const dx = posX - wp.x;
      const dz = posZ - wp.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestKey = key;
      }
    }
  });
  return bestKey;
}

export interface LineFollowerState {
  prevLateralError: number;
  travelDir: 1 | -1 | 0;
  lastTrackKey?: GroundTrackKey;
}

export interface PurePursuitLineDecision {
  steerAngle: number;
  speedMultiplier: number;
  lateralError: number;
  distToLine: number;
  lineDetected: boolean;
  confidence: number;
  trackKey: GroundTrackKey;
  targetPoint: TrackWaypoint;
  status: 'LINE_LOCKED' | 'LINE_ACQUIRING' | 'LINE_OBSTACLE_AVOID';
  nextState: LineFollowerState;
}

/**
 * Pure-Pursuit + PD Camera Line Tracking controller with heading-aware loop direction,
 * automatic track acquisition, and LiDAR obstacle-aware lateral offset / braking.
 */
export function computePurePursuitLineFollow(
  posX: number,
  posZ: number,
  headingRad: number,
  requestedTrack: 'auto' | GroundTrackKey,
  baseSpeedPercent: number,
  scanPoints: LidarScanPoint[] = [],
  state: LineFollowerState = { prevLateralError: 0, travelDir: 0 },
  dt = 0.05
): PurePursuitLineDecision {
  const trackKey: GroundTrackKey =
    requestedTrack === 'auto' ? findNearestGroundTrack(posX, posZ) : requestedTrack;
  const pts = GROUND_TRACK_LOOPS[trackKey].waypoints;
  const n = pts.length;

  let closestIdx = 0;
  let closestDistSq = Infinity;
  for (let i = 0; i < n; i++) {
    const dx = pts[i].x - posX;
    const dz = pts[i].z - posZ;
    const dSq = dx * dx + dz * dz;
    if (dSq < closestDistSq) {
      closestDistSq = dSq;
      closestIdx = i;
    }
  }
  const distToLine = Math.sqrt(closestDistSq);
  const closestPt = pts[closestIdx];

  const fwdX = Math.sin(headingRad);
  const fwdZ = Math.cos(headingRad);
  const nextPt = pts[(closestIdx + 1) % n];
  const prevPt = pts[(closestIdx - 1 + n) % n];
  const tangX = nextPt.x - prevPt.x;
  const tangZ = nextPt.z - prevPt.z;
  const dot = fwdX * tangX + fwdZ * tangZ;

  let travelDir: 1 | -1 =
    state.lastTrackKey === trackKey && state.travelDir !== 0
      ? state.travelDir
      : dot >= 0
      ? 1
      : -1;

  if (state.lastTrackKey === trackKey && Math.abs(dot) > 0.01) {
    const tangLen = Math.hypot(tangX, tangZ) || 1;
    const cosHeading = (dot / tangLen) * travelDir;
    if (cosHeading < -0.65 && distToLine > 1.2) {
      travelDir = dot >= 0 ? 1 : -1;
    }
  }

  const lookaheadMeters = distToLine > 2.2 ? 2.6 : 1.75;
  let accum = 0;
  let targetIdx = closestIdx;
  for (let step = 0; step < n / 2; step++) {
    const cur = pts[targetIdx];
    const nxtIdx = (targetIdx + travelDir + n) % n;
    const nxt = pts[nxtIdx];
    accum += Math.hypot(nxt.x - cur.x, nxt.z - cur.z);
    targetIdx = nxtIdx;
    if (accum >= lookaheadMeters) break;
  }
  const rawTarget = pts[targetIdx];

  let minFront = Infinity;
  let leftSpace = 0;
  let rightSpace = 0;
  for (const pt of scanPoints) {
    if (Math.abs(pt.angleDeg) <= 32 && pt.distance < minFront) {
      minFront = pt.distance;
    }
    if (pt.angleDeg > 25 && pt.angleDeg <= 75) leftSpace += Math.min(pt.distance, 4.0);
    if (pt.angleDeg < -25 && pt.angleDeg >= -75) rightSpace += Math.min(pt.distance, 4.0);
  }

  let lateralOffsetMeters = 0;
  let obstacleSlowFactor = 1.0;
  let isObstacleAvoiding = false;
  if (minFront < 1.05) {
    obstacleSlowFactor = 0.0;
    isObstacleAvoiding = true;
    lateralOffsetMeters = leftSpace >= rightSpace ? -1.1 : 1.1;
  } else if (minFront < 2.2) {
    isObstacleAvoiding = true;
    obstacleSlowFactor = 0.55;
    lateralOffsetMeters = leftSpace >= rightSpace ? -0.95 : 0.95;
  }

  const rightX = -Math.cos(headingRad);
  const rightZ = Math.sin(headingRad);
  const targetPoint: TrackWaypoint = {
    x: rawTarget.x + rightX * lateralOffsetMeters,
    z: rawTarget.z + rightZ * lateralOffsetMeters,
  };

  const closestDx = closestPt.x - posX;
  const closestDz = closestPt.z - posZ;
  const closestLocalRight = -closestDx * Math.cos(headingRad) + closestDz * Math.sin(headingRad);
  const lateralError = Math.max(-1, Math.min(1, closestLocalRight / 1.4));

  const targetDx = targetPoint.x - posX;
  const targetDz = targetPoint.z - posZ;
  const localFwd = targetDx * fwdX + targetDz * fwdZ;
  const localRight = -targetDx * Math.cos(headingRad) + targetDz * Math.sin(headingRad);
  const localLeft = -localRight;

  const angleToTarget = Math.atan2(localLeft, localFwd);

  const safeDt = Math.max(0.008, dt);
  const dErr = Math.max(-4, Math.min(4, (lateralError - state.prevLateralError) / safeDt));

  const steerCmd = Math.sin(angleToTarget) * 1.15 - dErr * 0.06;
  const steerAngle = Math.max(-1, Math.min(1, steerCmd));

  const turnSlow = Math.max(0.45, 1.0 - Math.abs(angleToTarget) * 0.42);
  const baseScale = Math.max(0.55, Math.min(1.0, baseSpeedPercent / 100 + 0.15));
  const speedMultiplier = obstacleSlowFactor === 0 ? 0 : turnSlow * obstacleSlowFactor * baseScale;

  const lineDetected = distToLine < 2.4;
  const confidence = lineDetected
    ? Math.round(Math.max(45, Math.min(99, 99 - distToLine * 20)))
    : Math.round(Math.max(12, 42 - Math.min(30, distToLine * 3)));

  const status: PurePursuitLineDecision['status'] = isObstacleAvoiding
    ? 'LINE_OBSTACLE_AVOID'
    : lineDetected
    ? 'LINE_LOCKED'
    : 'LINE_ACQUIRING';

  return {
    steerAngle,
    speedMultiplier,
    lateralError,
    distToLine,
    lineDetected,
    confidence,
    trackKey,
    targetPoint,
    status,
    nextState: {
      prevLateralError: lateralError,
      travelDir,
      lastTrackKey: trackKey,
    },
  };
}

/**
 * Interpolates exploded view component coordinates.
 */
export function getExplodedPosition(
  basePosition: { x: number; y: number; z: number },
  explodeOffset: { x: number; y: number; z: number },
  progress: number
) {
  const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  return {
    x: basePosition.x + explodeOffset.x * eased,
    y: basePosition.y + explodeOffset.y * eased,
    z: basePosition.z + explodeOffset.z * eased,
  };
}

export interface Vec3Offset {
  x: number;
  y: number;
  z: number;
}

export interface JetBotExplodedOffsets {
  eased: number;
  chassis: Vec3Offset;
  leftWheel: Vec3Offset;
  rightWheel: Vec3Offset;
  motorBoard: Vec3Offset;
  jetson: Vec3Offset;
  topDeck: Vec3Offset;
  lidar: Vec3Offset;
  camera: Vec3Offset;
  antennas: Vec3Offset;
  stereoCamera: Vec3Offset;
}

/**
 * Computes symmetric multi-axis exploded offsets for every JetBot sub-assembly.
 */
export function computeJetBotExplodedOffsets(progress: number): JetBotExplodedOffsets {
  const p = Math.max(0, Math.min(1, progress));
  const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

  return {
    eased,
    chassis: { x: 0, y: (-0.1 * eased) || 0, z: 0 },
    leftWheel: { x: (-0.46 * eased) || 0, y: 0, z: 0 },
    rightWheel: { x: (0.46 * eased) || 0, y: 0, z: 0 },
    motorBoard: { x: 0, y: (0.26 * eased) || 0, z: 0 },
    jetson: { x: 0, y: (0.62 * eased) || 0, z: 0 },
    topDeck: { x: 0, y: (0.98 * eased) || 0, z: 0 },
    lidar: { x: 0, y: (1.34 * eased) || 0, z: 0 },
    camera: { x: 0, y: (0.22 * eased) || 0, z: (0.46 * eased) || 0 },
    antennas: { x: 0, y: (0.42 * eased) || 0, z: (-0.42 * eased) || 0 },
    stereoCamera: { x: 0, y: (0.26 * eased) || 0, z: (0.5 * eased) || 0 },
  };
}

export const ALL_CAMERA_MODES = [
  'orbit',
  'chase',
  'fpv',
  'top',
  'wheel',
  'lidar',
  'cinematic',
] as const;

export type SupportedCameraMode = typeof ALL_CAMERA_MODES[number];

export function getNextCameraMode(current: string): SupportedCameraMode {
  const idx = ALL_CAMERA_MODES.indexOf(current as SupportedCameraMode);
  if (idx === -1) return 'orbit';
  return ALL_CAMERA_MODES[(idx + 1) % ALL_CAMERA_MODES.length];
}

export function getCameraFov(mode: string): number {
  switch (mode) {
    case 'fpv':
      return 82;
    case 'top':
      return 38;
    case 'wheel':
      return 68;
    case 'lidar':
      return 72;
    case 'cinematic':
      return 44;
    case 'chase':
      return 56;
    case 'orbit':
    default:
      return 48;
  }
}

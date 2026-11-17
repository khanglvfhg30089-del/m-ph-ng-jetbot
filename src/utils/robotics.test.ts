/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDifferentialKinematics,
  computeInverseKinematics,
  computeObstacleAvoidanceSteering,
  createInitialAvoidanceMemory,
  computeLineFollowerCommand,
  computePurePursuitLineFollow,
  GROUND_TRACK_LOOPS,
  findNearestGroundTrack,
  getExplodedPosition,
  computeJetBotExplodedOffsets,
  computeHarmonizedDrive,
  ALL_CAMERA_MODES,
  getNextCameraMode,
  getCameraFov,
} from './robotics';

test('computeDifferentialKinematics: forward motion', () => {
  const result = computeDifferentialKinematics(100, 100);
  assert.ok(result.linearVelocity > 0);
  assert.equal(Math.round(result.angularVelocity * 1000), 0);
});

test('computeDifferentialKinematics: pure rotation in place', () => {
  const result = computeDifferentialKinematics(-100, 100);
  assert.equal(Math.round(result.linearVelocity * 1000), 0);
  assert.ok(result.angularVelocity > 0);
});

test('computeInverseKinematics: round-trip consistency', () => {
  const linear = 0.3; // m/s
  const angular = 0.5; // rad/s
  const { leftRpm, rightRpm } = computeInverseKinematics(linear, angular);
  const forwardResult = computeDifferentialKinematics(leftRpm, rightRpm);

  assert.ok(Math.abs(forwardResult.linearVelocity - linear) < 0.01);
  assert.ok(Math.abs(forwardResult.angularVelocity - angular) < 0.01);
});

test('computeObstacleAvoidanceSteering: triggers evasion when obstacle is close', () => {
  const scan = [
    { angleDeg: 0, distance: 0.3 }, // Dangerous obstacle 30cm ahead
    { angleDeg: 60, distance: 1.5 }, // Clear left
    { angleDeg: -60, distance: 0.4 }, // Blocked right
  ];
  const decision = computeObstacleAvoidanceSteering(scan, 50);
  assert.equal(decision.emergencyStop, true);
  assert.equal(decision.steerAngle, 1.0); // should steer left towards 1.5m clearance
  assert.equal(decision.status, 'BACKUP_PIVOT');
});

test('computeObstacleAvoidanceSteering: FTG chooses widest open gap and avoids oscillation', () => {
  // Obstacle directly ahead and blocking right (-45..0 deg), open corridor at +50..+75 deg
  const scan = Array.from({ length: 47 }, (_, i) => {
    const angleDeg = -115 + i * 5;
    let distance = 6.5;
    if (angleDeg >= -50 && angleDeg <= 20) distance = 1.6;
    if (angleDeg >= 40 && angleDeg <= 80) distance = 9.0;
    return { angleDeg, distance };
  });

  const mem0 = createInitialAvoidanceMemory();
  const d1 = computeObstacleAvoidanceSteering(scan, 70, mem0, 0.05);
  assert.equal(d1.status, 'AVOIDING_LEFT');
  assert.ok(d1.steerAngle > 0.3, `Expected left steer > 0.3, got ${d1.steerAngle}`);
  assert.ok(d1.targetGapDeg >= 35, `Expected gap angle >= 35, got ${d1.targetGapDeg}`);

  // Hysteresis: even if left and right become nearly symmetric on next frame, memory preserves left bias
  const symmetricScan = [
    { angleDeg: 0, distance: 0.7 },
    { angleDeg: 65, distance: 1.8 },
    { angleDeg: -65, distance: 1.85 },
  ];
  const d2 = computeObstacleAvoidanceSteering(symmetricScan, 70, d1.nextMemory, 0.05);
  assert.equal(d2.nextMemory.turnBias, 1);
  assert.ok(d2.steerAngle > 0);
});

test('computeLineFollowerCommand: steers towards line center', () => {
  const rightDrift = computeLineFollowerCommand(0.5, 50);
  assert.ok(rightDrift.steerAngle < 0); // steers right to pull line back under robot center

  const leftDrift = computeLineFollowerCommand(-0.5, 50);
  assert.ok(leftDrift.steerAngle > 0); // steers left to pull line back under robot center
});

test('findNearestGroundTrack selects closest zone track automatically', () => {
  assert.equal(findNearestGroundTrack(0, 5.5), 'roundabout');
  assert.equal(findNearestGroundTrack(15, -8.5), 'race_track');
  assert.equal(findNearestGroundTrack(-17.5, 9.2), 'warehouse_agv');
});

test('computePurePursuitLineFollow converges smoothly onto race_track in both CW and CCW directions', () => {
  for (const initialHeading of [Math.PI / 2, -Math.PI / 2]) {
    let x = 15.0;
    let z = -9.4; // start 0.9m off track center (-8.5)
    let heading = initialHeading;
    let state: { prevLateralError: number; travelDir: -1 | 0 | 1; lastTrackKey?: 'roundabout' | 'race_track' | 'warehouse_agv' } = {
      prevLateralError: 0,
      travelDir: 0,
    };

    const dt = 0.05;
    for (let step = 0; step < 90; step++) {
      const dec = computePurePursuitLineFollow(x, z, heading, 'race_track', 70, [], state, dt);
      state = dec.nextState;
      const linVel = dec.speedMultiplier * 2.2 * 0.7;
      const angVel = dec.steerAngle * 2.5 * 0.9;
      heading += angVel * dt;
      x += Math.sin(heading) * linVel * dt;
      z += Math.cos(heading) * linVel * dt;
    }

    const finalDecision = computePurePursuitLineFollow(x, z, heading, 'race_track', 70, [], state, dt);
    assert.ok(
      finalDecision.distToLine < 0.45,
      `Heading ${initialHeading}: expected convergence < 0.45m, got ${finalDecision.distToLine}`
    );
    assert.equal(finalDecision.status, 'LINE_LOCKED');
    assert.ok(finalDecision.confidence >= 85);
  }
});

test('computePurePursuitLineFollow tracks warehouse_agv loop & respects LiDAR obstacle hold', () => {
  const spawn = GROUND_TRACK_LOOPS.warehouse_agv.spawn;
  // Clear path -> cruises confidently
  const clearDecision = computePurePursuitLineFollow(
    spawn.x,
    spawn.z,
    spawn.heading,
    'warehouse_agv',
    65,
    [{ angleDeg: 0, distance: 5.0 }]
  );
  assert.equal(clearDecision.status, 'LINE_LOCKED');
  assert.ok(clearDecision.speedMultiplier > 0.4);

  // Blocked path directly on line -> engages LINE_OBSTACLE_AVOID & stops
  const blockedDecision = computePurePursuitLineFollow(
    spawn.x,
    spawn.z,
    spawn.heading,
    'warehouse_agv',
    65,
    [
      { angleDeg: 0, distance: 0.85 },
      { angleDeg: 50, distance: 3.5 },
      { angleDeg: -50, distance: 0.9 },
    ]
  );
  assert.equal(blockedDecision.status, 'LINE_OBSTACLE_AVOID');
  assert.equal(blockedDecision.speedMultiplier, 0);
});

test('getExplodedPosition: returns interpolated coords', () => {
  const base = { x: 0, y: 1, z: 0 };
  const offset = { x: 0, y: 2, z: 0 };

  const p0 = getExplodedPosition(base, offset, 0);
  assert.equal(p0.y, 1);

  const p1 = getExplodedPosition(base, offset, 1);
  assert.equal(p1.y, 3);
});

test('computeHarmonizedDrive: forward and turn speeds are properly balanced and compatible', () => {
  // At 60% speed:
  const straight = computeHarmonizedDrive({ forward: true, backward: false, left: false, right: false }, 60);
  const turnInPlace = computeHarmonizedDrive({ forward: false, backward: false, left: true, right: false }, 60);

  assert.ok(straight.linearVelocity > 1.0 && straight.linearVelocity < 2.0);
  assert.equal(straight.angularVelocity, 0);

  // Turn speed should be realistic (around 1.2 to 2.0 rad/s), not wildly 15-20 rad/s
  assert.ok(Math.abs(turnInPlace.angularVelocity) >= 1.2 && Math.abs(turnInPlace.angularVelocity) <= 2.0);
  assert.equal(turnInPlace.linearVelocity, 0);

  // Right turn: left wheel spins faster, heading decreases towards -X
  const turnRight = computeHarmonizedDrive({ forward: false, backward: false, left: false, right: true }, 60);
  assert.ok(turnRight.angularVelocity < 0);
  assert.ok(turnRight.leftRpm > turnRight.rightRpm);

  // Left turn: right wheel spins faster, heading increases towards +X
  assert.ok(turnInPlace.angularVelocity > 0);
  assert.ok(turnInPlace.rightRpm > turnInPlace.leftRpm);
});

test('camera modes: exactly 7 comprehensive viewpoints defined', () => {
  assert.equal(ALL_CAMERA_MODES.length, 7);
  assert.deepEqual(ALL_CAMERA_MODES, [
    'orbit',
    'chase',
    'fpv',
    'top',
    'wheel',
    'lidar',
    'cinematic',
  ]);
});

test('camera cycling: loops seamlessly through all 7 views', () => {
  let mode: any = 'orbit';
  const visited: string[] = [mode];
  for (let i = 0; i < 7; i++) {
    mode = getNextCameraMode(mode);
    visited.push(mode);
  }
  assert.equal(visited[visited.length - 1], 'orbit'); // looped back to start
  assert.equal(visited[1], 'chase');
  assert.equal(visited[2], 'fpv');
  assert.equal(visited[3], 'top');
  assert.equal(visited[4], 'wheel');
  assert.equal(visited[5], 'lidar');
  assert.equal(visited[6], 'cinematic');
});

test('camera FOVs: tailored optics for each perspective', () => {
  assert.equal(getCameraFov('fpv'), 82); // ultra-wide CSI lens
  assert.equal(getCameraFov('top'), 38); // orthographic-like telephoto
  assert.equal(getCameraFov('wheel'), 68); // dynamic ground view
  assert.equal(getCameraFov('lidar'), 72); // turret panoramic overview
  assert.equal(getCameraFov('cinematic'), 44); // studio showcase
  assert.equal(getCameraFov('chase'), 56); // chase depth
  assert.equal(getCameraFov('orbit'), 48); // standard orbit
});

test('computeJetBotExplodedOffsets: zero offsets when assembled and symmetric multi-axis separation when exploded', () => {
  const zero = computeJetBotExplodedOffsets(0);
  assert.equal(zero.eased, 0);
  assert.equal(zero.leftWheel.x, 0);
  assert.equal(zero.rightWheel.x, 0);
  assert.equal(zero.jetson.y, 0);

  const half = computeJetBotExplodedOffsets(0.5);
  assert.ok(half.leftWheel.x < 0 && half.rightWheel.x > 0);
  assert.equal(half.leftWheel.x, -half.rightWheel.x);

  const full = computeJetBotExplodedOffsets(1.0);
  assert.equal(full.eased, 1);
  // Symmetric bilateral wheel separation along axle
  assert.ok(full.leftWheel.x < -0.4);
  assert.equal(full.leftWheel.x, -full.rightWheel.x);
  // Strictly monotonic vertical layer stack
  assert.ok(
    full.chassis.y < full.motorBoard.y &&
      full.motorBoard.y < full.jetson.y &&
      full.jetson.y < full.topDeck.y &&
      full.topDeck.y < full.lidar.y
  );
  // Camera pulls forward (+Z), antennas pull rearward (-Z)
  assert.ok(full.camera.z > 0.3);
  assert.ok(full.antennas.z < -0.3);
});



/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildJetBotModel, JetBotModelRefs } from './JetBotModel';
import {
  buildArenaEnvironment,
  ObstacleObject,
  ArenaEnvironmentRefs,
  ARENA_HALF_SIZE,
  ARENA_SAFE_BOUND,
  MAP_ZONES,
} from './ArenaEnvironment';
import {
  computeObstacleAvoidanceSteering,
  createInitialAvoidanceMemory,
  AvoidanceMemory,
  computePurePursuitLineFollow,
  LineFollowerState,
  GROUND_TRACK_LOOPS,
  GroundTrackKey,
  computeHarmonizedDrive,
  HARMONIZED_SPECS,
  DriveInputs,
  LidarScanPoint,
} from '../../utils/robotics';
import { soundEngine } from '../../utils/audio';
import {
  AutoStatusCode,
  CameraViewMode,
  DriveDirection,
  EnvironmentTheme,
  LineTrackId,
  MapZoneId,
  ModelVariant,
  RenderShaderStyle,
  ComponentHotspot,
  TelemetryData,
} from '../../types/jetbot';


export interface SceneManagerCallbacks {
  onTelemetryUpdate: (telemetry: TelemetryData) => void;
  onLidarScan: (points: LidarScanPoint[], closestDist: number) => void;
  onComponentSelect: (componentId: string | null) => void;
  onComponentHover?: (hoverInfo: { id: string; nameVi: string; clientX: number; clientY: number } | null) => void;
  onHotspotsUpdate?: (hotspots: ComponentHotspot[]) => void;
}

export class JetBotSceneManager {
  private container: HTMLDivElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private fpvCamera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private jetbot: JetBotModelRefs;
  private arena!: ArenaEnvironmentRefs;
  private obstacles: ObstacleObject[] = [];
  private updateShadow: (pos: THREE.Vector3) => void = () => {};
  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private rimLight!: THREE.DirectionalLight;

  private isSoftwareGl = false;
  private isDestroyed = false;
  private animFrameId = 0;

  // Real-time lighting & realism features
  private headlightsEnabled = true;
  private laserBeamEnabled = true;
  private currentTheme: EnvironmentTheme = 'cyber_lab';

  // Kinematic state
  private robotPos = new THREE.Vector3(0, 0, 0);
  private robotHeading = 0; // radians (0 faces +Z)
  private leftRpm = 0;
  private rightRpm = 0;
  private speedPercent = 60;
  private driveDir: DriveDirection = 'stop';
  private driveInputs: DriveInputs = { forward: false, backward: false, left: false, right: false };
  private cameraMode: CameraViewMode = 'orbit';

  // Enhanced Multi-Perspective Camera System
  private targetFov = 48;
  private cinematicAngle = 0;
  private fpvShakeTimer = 0;
  private activeLinearVel = 0;
  private activeAngularVel = 0;

  // Autopilot & Line-Follower state
  private isAutopilot = false;
  private isLineFollower = false;
  private avoidanceMemory: AvoidanceMemory = createInitialAvoidanceMemory();
  private lineFollowerState: LineFollowerState = { prevLateralError: 0, travelDir: 0 };
  private selectedLineTrack: LineTrackId = 'auto';
  private lastAutoStatus: AutoStatusCode = 'MANUAL';
  private lastTargetGapDeg = 0;
  private lastLineError = 0;
  private lastLineDetected = false;
  private lastLineConfidence = 0;
  private lastActiveTrackId: GroundTrackKey = 'roundabout';
  private lastSteerAngle = 0;
  private lastObstacleStop = false;

  // Exploded view
  private currentExplode = 0;
  private targetExplode = 0;

  // 3D Model Studio state
  private autoRotateEnabled = false;
  private autoRotateSpeed = 1.0;
  private turntableAngle = 0;

  // Smooth damped camera transition state (canceled on user orbit/zoom)
  private cameraTransition: { camPos: THREE.Vector3; target: THREE.Vector3 } | null = null;

  // Component Focus & Isolation state
  private isolatedPartId: string | null = null;
  private isolatedMode: 'solo' | 'ghost' | 'none' = 'none';
  private hotspotsActive = false;
  private lastHotspotsSignature = '';

  // Timing & telemetry
  private lastTime = performance.now();
  private telemetryTimer = 0;
  private lidarTimer = 0;
  private batteryLevel = 88; // %

  // Interaction
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private pointerDownPos: { x: number; y: number } | null = null;
  private callbacks: SceneManagerCallbacks;

  constructor(container: HTMLDivElement, callbacks: SceneManagerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Detect Software GL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Initialize Three.js Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    // 3. Scene & Studio Lighting
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);
    this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.017);

    // Procedural Studio Environment Reflection (calibrated so it never washes out dark surfaces)
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.42;
      pmrem.dispose();
    } catch {
      console.warn('RoomEnvironment fallback');
    }

    // Key Light (Warm, crisp shadow with calibrated normalBias to eliminate acne)
    this.keyLight = new THREE.DirectionalLight(0xfff4e0, 1.65);
    this.keyLight.position.set(7, 13, 8);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.width = this.isSoftwareGl ? 1024 : 2048;
    this.keyLight.shadow.mapSize.height = this.isSoftwareGl ? 1024 : 2048;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 36;
    const d = 10;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0003;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    // Cool Hemisphere Fill Light
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.72);
    this.hemiLight.position.set(0, 12, 0);
    this.scene.add(this.hemiLight);

    // Subtle Rim Light separating dark aluminum & tires from backdrop
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    this.rimLight.position.set(-7, 6, -9);
    this.scene.add(this.rimLight);

    // 4. Cameras (Front 3/4 Hero Orbit Angle showing CSI Camera, Blue Rims & RPLIDAR)
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 140);
    this.camera.position.set(2.45, 2.25, 3.25);

    // First Person Camera mounted on JetBot front eye
    this.fpvCamera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 45);
    this.fpvCamera.position.set(0, 0.65, 1.15);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 70.0;
    this.controls.target.set(0, 0.55, 0);

    // 5. Build Arena Environment & JetBot Model
    this.arena = buildArenaEnvironment(this.scene, { maxAnisotropy });
    this.obstacles = this.arena.obstacles;
    this.updateShadow = this.arena.updateShadowPosition;

    this.jetbot = buildJetBotModel({ isSoftwareGl: this.isSoftwareGl, maxAnisotropy });
    this.jetbot.rootGroup.add(this.fpvCamera);
    this.scene.add(this.jetbot.rootGroup);
    this.jetbot.setHeadlights(this.headlightsEnabled);
    this.jetbot.setLaserBeamVisible(this.laserBeamEnabled);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 6. Event Listeners
    window.addEventListener('resize', this.onResize);
    this.controls.addEventListener('start', this.onControlsStart);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);

    // Render Frame 1 immediately so canvas is painted on initial load, then enter paced loop
    this.updateSimulation(0.016);
    this.renderScene();
    this.startLoop();
  }

  private hotspotFrameCounter = 0;

  // Paced loop adhering to ultra-mode and threejs skill
  private startLoop = () => {
    const tick = () => {
      if (this.isDestroyed) return;

      const now = performance.now();
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;

      this.updateSimulation(dt);
      this.renderScene();
      this.updateHotspots();

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.animFrameId = requestAnimationFrame(tick);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDestroyed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.animFrameId = window.setTimeout(poll, 6);
      } else {
        if (sync) gl.deleteSync(sync);
        this.animFrameId = window.setTimeout(cb, 60);
      }
    };
    this.animFrameId = window.setTimeout(poll, 6);
  }

  /**
   * Main Physics & Kinematics Update
   */
  private onControlsStart = () => {
    this.cameraTransition = null;
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private updateSimulation(dt: number) {
    // 1. Frame-rate independent damped Exploded View Interpolation
    if (Math.abs(this.currentExplode - this.targetExplode) > 0.001) {
      this.currentExplode = THREE.MathUtils.damp(this.currentExplode, this.targetExplode, 9, dt);
      if (Math.abs(this.currentExplode - this.targetExplode) <= 0.001) {
        this.currentExplode = this.targetExplode;
      }
      this.jetbot.setExplodeProgress(this.currentExplode);
    }

    // 2. Rotate RPLIDAR turret
    this.jetbot.updateLidarRotation(dt * 12); // ~110 RPM laser sweep

    // 3D Model Studio Turntable 360 Auto-Rotation
    if (this.autoRotateEnabled && this.driveDir === 'stop' && !this.isAutopilot && !this.isLineFollower) {
      this.turntableAngle += dt * 0.55 * this.autoRotateSpeed;
    }

    // 3. Determine Motor Commands based on Drive Mode
    const baseRpm = Math.round((this.speedPercent / 100) * 180);

    // Raycast real-time 360° LiDAR points
    const lidarPoints = this.calculateLidarScan();
    let closestDist = Infinity;
    for (const p of lidarPoints) {
      if (p.distance < closestDist) closestDist = p.distance;
    }

    let linearVel = 0;
    let angularVel = 0;

    if (this.isAutopilot) {
      // Autonomous Follow-The-Gap Obstacle Avoidance via 360° LiDAR
      const decision = computeObstacleAvoidanceSteering(
        lidarPoints,
        this.speedPercent,
        this.avoidanceMemory,
        dt
      );
      this.avoidanceMemory = decision.nextMemory;
      if (decision.emergencyStop) {
        soundEngine.playObstacleAlert();
      }

      const speedScale = Math.max(0.15, Math.min(1.0, this.speedPercent / 100));
      linearVel = decision.speedMultiplier * HARMONIZED_SPECS.maxLinearSpeed * speedScale * 0.85;
      // Convention: steerAngle > 0 turns LEFT (+heading), steerAngle < 0 turns RIGHT (-heading)
      angularVel = decision.steerAngle * HARMONIZED_SPECS.maxAngularSpeed * speedScale * 0.88;

      this.lastAutoStatus = decision.status;
      this.lastTargetGapDeg = decision.targetGapDeg;
      this.lastSteerAngle = decision.steerAngle;
      this.lastObstacleStop = decision.emergencyStop;

      const halfBase = HARMONIZED_SPECS.effectiveWheelBase / 2;
      const vLeft = linearVel - angularVel * halfBase;
      const vRight = linearVel + angularVel * halfBase;
      this.leftRpm = Math.round((vLeft / HARMONIZED_SPECS.maxLinearSpeed) * (speedScale * 180));
      this.rightRpm = Math.round((vRight / HARMONIZED_SPECS.maxLinearSpeed) * (speedScale * 180));
    } else if (this.isLineFollower) {
      // Pure Pursuit + PD Camera Line Tracking with LiDAR obstacle safety
      const lineDecision = computePurePursuitLineFollow(
        this.robotPos.x,
        this.robotPos.z,
        this.robotHeading,
        this.selectedLineTrack,
        this.speedPercent,
        lidarPoints,
        this.lineFollowerState,
        dt
      );
      this.lineFollowerState = lineDecision.nextState;

      const speedScale = Math.max(0.15, Math.min(1.0, this.speedPercent / 100));
      linearVel = lineDecision.speedMultiplier * HARMONIZED_SPECS.maxLinearSpeed * 0.78;
      angularVel = lineDecision.steerAngle * HARMONIZED_SPECS.maxAngularSpeed * 0.95;

      if (lineDecision.status === 'LINE_OBSTACLE_AVOID' && lineDecision.speedMultiplier === 0) {
        soundEngine.playObstacleAlert();
        angularVel = lineDecision.steerAngle * HARMONIZED_SPECS.maxAngularSpeed * 0.55;
      }

      this.lastAutoStatus = lineDecision.status;
      this.lastLineError = parseFloat(lineDecision.lateralError.toFixed(3));
      this.lastLineDetected = lineDecision.lineDetected;
      this.lastLineConfidence = lineDecision.confidence;
      this.lastActiveTrackId = lineDecision.trackKey;
      this.lastSteerAngle = lineDecision.steerAngle;
      this.lastObstacleStop = lineDecision.status === 'LINE_OBSTACLE_AVOID';

      const halfBase = HARMONIZED_SPECS.effectiveWheelBase / 2;
      const vLeft = linearVel - angularVel * halfBase;
      const vRight = linearVel + angularVel * halfBase;
      this.leftRpm = Math.round((vLeft / HARMONIZED_SPECS.maxLinearSpeed) * (speedScale * 180));
      this.rightRpm = Math.round((vRight / HARMONIZED_SPECS.maxLinearSpeed) * (speedScale * 180));
    } else {
      // Manual Harmonized Drive
      const harmonized = computeHarmonizedDrive(this.driveInputs, this.speedPercent);
      linearVel = harmonized.linearVelocity;
      angularVel = harmonized.angularVelocity;
      this.leftRpm = harmonized.leftRpm;
      this.rightRpm = harmonized.rightRpm;
      this.lastAutoStatus = 'MANUAL';
      this.lastTargetGapDeg = 0;
      this.lastObstacleStop = false;
    }

    this.activeLinearVel = linearVel;
    this.activeAngularVel = angularVel;

    // Sound engine motor pitch modulation
    soundEngine.updateMotorSound(Math.max(Math.abs(this.leftRpm), Math.abs(this.rightRpm)));

    // 4. Integrate Harmonized Kinematics & Physics
    const forwardStep = linearVel * dt;
    const turnStep = angularVel * dt;

    // Apply rotation (preserving manual/autonomous heading + studio turntable angle)
    this.robotHeading += turnStep;
    this.jetbot.rootGroup.rotation.y = this.robotHeading + this.turntableAngle;

    // Apply translation along forward vector
    const forwardVec = new THREE.Vector3(
      Math.sin(this.robotHeading),
      0,
      Math.cos(this.robotHeading)
    );

    // Collision check against 60m arena boundaries & 3D obstacles
    const nextPos = this.robotPos.clone().addScaledVector(forwardVec, forwardStep);
    let canMove = true;

    // 60m Arena boundary check
    if (Math.abs(nextPos.x) > ARENA_SAFE_BOUND || Math.abs(nextPos.z) > ARENA_SAFE_BOUND) {
      canMove = false;
    }

    if (canMove) {
      for (const obs of this.obstacles) {
        if (obs.halfSize) {
          // Precise rectangular bounding box check
          const dx = Math.abs(nextPos.x - obs.position.x);
          const dz = Math.abs(nextPos.z - obs.position.z);
          if (dx < obs.halfSize.x + 0.55 && dz < obs.halfSize.z + 0.55) {
            canMove = false;
            break;
          }
        } else {
          // Cylindrical / radial clearance check
          const d = nextPos.distanceTo(obs.position);
          if (d < obs.radius + 0.5) {
            canMove = false;
            break;
          }
        }
      }
    }

    if (canMove) {
      this.robotPos.copy(nextPos);
      this.jetbot.rootGroup.position.copy(this.robotPos);
      this.updateShadow(this.robotPos);

      // Rotate individual 3D wheels accurately matching physical ground velocity
      const halfBase = HARMONIZED_SPECS.effectiveWheelBase / 2;
      const vLeft = linearVel - angularVel * halfBase;
      const vRight = linearVel + angularVel * halfBase;
      const leftWheelDelta = (vLeft / HARMONIZED_SPECS.effectiveWheelRadius) * dt;
      const rightWheelDelta = (vRight / HARMONIZED_SPECS.effectiveWheelRadius) * dt;
      this.jetbot.updateWheelRotations(leftWheelDelta, rightWheelDelta);
    } else {
      soundEngine.playObstacleAlert();
      if (this.isAutopilot) {
        // Auto-recover from physical stall by committing a reverse-and-pivot turn
        this.avoidanceMemory = {
          turnBias: this.avoidanceMemory.turnBias !== 0 ? this.avoidanceMemory.turnBias : 1,
          backupTimer: 0.52,
        };
      }
    }

    // Dynamic Suspension Body Tilting & Brake Light Response
    const isBraking =
      this.driveInputs.backward ||
      this.lastObstacleStop ||
      (this.driveDir === 'stop' && Math.abs(linearVel) > 0.05);
    const turnDir = this.driveInputs.left ? -1 : this.driveInputs.right ? 1 : 0;
    this.jetbot.updateMotionDynamics(linearVel, angularVel, isBraking, turnDir, dt);
    this.jetbot.updateAutonomyVisuals({
      mode: this.isAutopilot ? 'obstacle_avoidance' : this.isLineFollower ? 'line_follower' : 'manual',
      steerAngle: this.lastSteerAngle,
      targetGapDeg: this.lastTargetGapDeg,
      lineError: this.lastLineError,
      lineDetected: this.lastLineDetected,
      isObstacleStop: this.lastObstacleStop,
    });

    // Dynamic Environment Animations (traffic lights, etc.)
    this.arena.updateEnvironment(dt);

    // 5. Camera Damping Updates
    this.updateCameras(dt);

    // 6. Broadcast Telemetry periodically (every 100ms)
    this.telemetryTimer += dt;
    if (this.telemetryTimer >= 0.1) {
      this.telemetryTimer = 0;
      const headingDeg = Math.round(((-this.robotHeading * 180) / Math.PI) % 360);
      const normalizedHeading = (headingDeg + 360) % 360;

      this.callbacks.onTelemetryUpdate({
        leftMotorSpeed: this.leftRpm,
        rightMotorSpeed: this.rightRpm,
        linearVelocity: parseFloat(linearVel.toFixed(2)),
        angularVelocity: parseFloat(angularVel.toFixed(2)),
        batteryVoltage: parseFloat((11.4 + (this.batteryLevel / 100) * 1.2).toFixed(1)),
        batteryPercent: this.batteryLevel,
        wifiSignalDbm: -42,
        cpuTemp: 46 + Math.round((Math.abs(this.leftRpm) / 200) * 12),
        gpuUsage: this.isAutopilot || this.isLineFollower ? 78 : Math.round((Math.abs(this.leftRpm) / 200) * 45),
        closestObstacleDist: parseFloat(closestDist.toFixed(2)),
        headingDeg: normalizedHeading,
        currentMode: this.isAutopilot
          ? 'obstacle_avoidance'
          : this.isLineFollower
          ? 'line_follower'
          : 'manual',
        posX: parseFloat(this.robotPos.x.toFixed(2)),
        posZ: parseFloat(this.robotPos.z.toFixed(2)),
        autoStatus: this.lastAutoStatus,
        targetGapDeg: this.lastTargetGapDeg,
        lineError: this.lastLineError,
        lineDetected: this.lastLineDetected,
        lineConfidence: this.lastLineConfidence,
        activeTrackId: this.lastActiveTrackId,
      });

      this.callbacks.onLidarScan(lidarPoints, closestDist);
    }
  }

  /**
   * Casts 360° laser rays across the 60m proving ground.
   */
  private calculateLidarScan(): LidarScanPoint[] {
    const points: LidarScanPoint[] = [];
    const numRays = 72; // Sample every 5 degrees for smooth 60fps performance
    const angleStep = (Math.PI * 2) / numRays;

    const bound = ARENA_HALF_SIZE - 0.2; // 28.8m
    const rayOrigin = this.robotPos.clone().add(new THREE.Vector3(0, 0.45, 0));

    for (let i = 0; i < numRays; i++) {
      const angle = i * angleStep;
      // World angle of ray
      const worldAngle = this.robotHeading + angle;
      const rayDir = new THREE.Vector3(Math.sin(worldAngle), 0, Math.cos(worldAngle));

      let minDistance = 14.0; // RPLIDAR A1 max range ~14m

      // Check distance against 60m rectangular arena outer boundaries
      const tX1 = (bound - rayOrigin.x) / rayDir.x;
      const tX2 = (-bound - rayOrigin.x) / rayDir.x;
      const tZ1 = (bound - rayOrigin.z) / rayDir.z;
      const tZ2 = (-bound - rayOrigin.z) / rayDir.z;

      [tX1, tX2, tZ1, tZ2].forEach((t) => {
        if (t > 0 && t < minDistance) {
          const hit = rayOrigin.clone().addScaledVector(rayDir, t);
          if (Math.abs(hit.x) <= bound + 0.1 && Math.abs(hit.z) <= bound + 0.1) {
            minDistance = t;
          }
        }
      });

      // Check distance against obstacles
      for (const obs of this.obstacles) {
        if (obs.halfSize) {
          // AABB ray intersection test
          const minX = obs.position.x - obs.halfSize.x;
          const maxX = obs.position.x + obs.halfSize.x;
          const minZ = obs.position.z - obs.halfSize.z;
          const maxZ = obs.position.z + obs.halfSize.z;

          let tmin = (minX - rayOrigin.x) / rayDir.x;
          let tmax = (maxX - rayOrigin.x) / rayDir.x;
          if (tmin > tmax) { const temp = tmin; tmin = tmax; tmax = temp; }

          let tzmin = (minZ - rayOrigin.z) / rayDir.z;
          let tzmax = (maxZ - rayOrigin.z) / rayDir.z;
          if (tzmin > tzmax) { const temp = tzmin; tzmin = tzmax; tzmax = temp; }

          if (!(tmin > tzmax || tzmin > tmax)) {
            const hitT = Math.max(tmin, tzmin);
            if (hitT > 0 && hitT < minDistance) {
              minDistance = hitT;
            }
          }
        } else {
          // Circular / cylindrical obstacle ray intersection
          const toObs = obs.position.clone().sub(rayOrigin);
          toObs.y = 0;
          const proj = toObs.dot(rayDir);
          if (proj > 0 && proj < minDistance) {
            const perpDist = Math.sqrt(Math.max(0, toObs.lengthSq() - proj * proj));
            if (perpDist <= obs.radius) {
              const hitDist = proj - Math.sqrt(Math.max(0, obs.radius * obs.radius - perpDist * perpDist));
              if (hitDist > 0 && hitDist < minDistance) {
                minDistance = hitDist;
              }
            }
          }
        }
      }

      // Convert angle to degrees relative to JetBot heading (-180 to +180)
      let deg = (angle * 180) / Math.PI;
      if (deg > 180) deg -= 360;

      points.push({
        angleDeg: Math.round(deg),
        distance: minDistance,
      });
    }

    return points;
  }

  private updateCameras(dt: number) {
    // 1. Dynamic Smooth FOV transition
    if (Math.abs(this.camera.fov - this.targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, Math.min(1, dt * 7));
      this.camera.updateProjectionMatrix();
    }

    const forwardVec = new THREE.Vector3(
      Math.sin(this.robotHeading),
      0,
      Math.cos(this.robotHeading)
    );
    const rightVec = new THREE.Vector3(
      Math.cos(this.robotHeading),
      0,
      -Math.sin(this.robotHeading)
    );

    if (this.cameraMode === 'chase') {
      this.controls.enabled = false;
      // Dynamic chase camera behind JetBot with banking & speed-dependent FOV
      const speedNorm = Math.min(1, Math.abs(this.activeLinearVel) / HARMONIZED_SPECS.maxLinearSpeed);
      this.targetFov = 54 + speedNorm * 5;

      const dist = 3.9 + speedNorm * 0.4;
      const height = 1.95 + (this.driveInputs.backward ? 0.35 : 0);
      const offset = forwardVec.clone().multiplyScalar(-dist).add(new THREE.Vector3(0, height, 0));
      
      const targetCamPos = this.robotPos.clone().add(offset);
      const lookTarget = this.robotPos.clone()
        .add(forwardVec.clone().multiplyScalar(2.2))
        .add(new THREE.Vector3(0, 0.45, 0));

      this.camera.position.lerp(targetCamPos, Math.min(1, dt * 7.5));
      this.controls.target.lerp(lookTarget, Math.min(1, dt * 8.5));
      this.camera.lookAt(this.controls.target);

    } else if (this.cameraMode === 'fpv') {
      this.controls.enabled = false;
      this.targetFov = 82; // Authentic CSI wide-angle lens (approx. 160° diagonal)

      const camMount = this.robotPos.clone()
        .add(forwardVec.clone().multiplyScalar(1.15))
        .add(new THREE.Vector3(0, 0.62, 0));

      // Realistic subtle micro engine vibration during movement
      if (Math.abs(this.leftRpm) > 5 || Math.abs(this.rightRpm) > 5) {
        this.fpvShakeTimer += dt * 32;
        camMount.y += Math.sin(this.fpvShakeTimer) * 0.0035;
        camMount.x += Math.cos(this.fpvShakeTimer * 0.5) * 0.0025;
      }

      const lookTarget = camMount.clone()
        .add(forwardVec.clone().multiplyScalar(12.0))
        .add(new THREE.Vector3(0, -0.15, 0));

      this.camera.position.lerp(camMount, Math.min(1, dt * 16));
      this.controls.target.lerp(lookTarget, Math.min(1, dt * 16));
      this.camera.lookAt(this.controls.target);

    } else if (this.cameraMode === 'top') {
      this.controls.enabled = false;
      this.targetFov = 38; // Crisp telephoto bird's-eye perspective
      const targetCamPos = new THREE.Vector3(this.robotPos.x, this.robotPos.y + 14.2, this.robotPos.z + 0.02);
      this.camera.position.lerp(targetCamPos, Math.min(1, dt * 6.5));
      this.controls.target.lerp(this.robotPos, Math.min(1, dt * 8));
      this.camera.lookAt(this.controls.target);

    } else if (this.cameraMode === 'wheel') {
      this.controls.enabled = false;
      this.targetFov = 68; // Dynamic ground stance
      // Low perspective right next to the left wheel rim and ground
      const wheelCamPos = this.robotPos.clone()
        .add(rightVec.clone().multiplyScalar(-1.42))
        .add(forwardVec.clone().multiplyScalar(-0.6))
        .add(new THREE.Vector3(0, 0.34, 0));

      const lookTarget = this.robotPos.clone()
        .add(forwardVec.clone().multiplyScalar(2.0))
        .add(rightVec.clone().multiplyScalar(-0.2))
        .add(new THREE.Vector3(0, 0.22, 0));

      this.camera.position.lerp(wheelCamPos, Math.min(1, dt * 8.5));
      this.controls.target.lerp(lookTarget, Math.min(1, dt * 9.5));
      this.camera.lookAt(this.controls.target);

    } else if (this.cameraMode === 'lidar') {
      this.controls.enabled = false;
      this.targetFov = 72; // Turret overview
      // Perched directly above the spinning RPLIDAR unit
      const lidarTurretPos = this.robotPos.clone()
        .add(forwardVec.clone().multiplyScalar(-0.25))
        .add(new THREE.Vector3(0, 1.55, 0));

      const lookTarget = this.robotPos.clone()
        .add(forwardVec.clone().multiplyScalar(6.5))
        .add(new THREE.Vector3(0, 0.75, 0));

      this.camera.position.lerp(lidarTurretPos, Math.min(1, dt * 8.5));
      this.controls.target.lerp(lookTarget, Math.min(1, dt * 9.5));
      this.camera.lookAt(this.controls.target);

    } else if (this.cameraMode === 'cinematic') {
      this.controls.enabled = false;
      this.targetFov = 44; // Showcase telephoto
      this.cinematicAngle += dt * 0.42; // Smooth studio rotation

      const radius = 4.4;
      const height = 1.95 + Math.sin(this.cinematicAngle * 1.5) * 0.45;
      const cinematicPos = new THREE.Vector3(
        this.robotPos.x + Math.sin(this.cinematicAngle) * radius,
        this.robotPos.y + height,
        this.robotPos.z + Math.cos(this.cinematicAngle) * radius
      );

      const lookTarget = this.robotPos.clone().add(new THREE.Vector3(0, 0.45, 0));
      this.camera.position.lerp(cinematicPos, Math.min(1, dt * 4.5));
      this.controls.target.lerp(lookTarget, Math.min(1, dt * 6.5));
      this.camera.lookAt(this.controls.target);

    } else {
      // 'orbit' mode:
      this.controls.enabled = true;
      this.targetFov = this.isolatedPartId && this.isolatedMode !== 'none' ? 38 : 48;

      if (this.cameraTransition) {
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.cameraTransition.camPos.x, 8.5, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.cameraTransition.camPos.y, 8.5, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.cameraTransition.camPos.z, 8.5, dt);
        this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, this.cameraTransition.target.x, 9.5, dt);
        this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.cameraTransition.target.y, 9.5, dt);
        this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.cameraTransition.target.z, 9.5, dt);

        if (
          this.camera.position.distanceTo(this.cameraTransition.camPos) < 0.02 &&
          this.controls.target.distanceTo(this.cameraTransition.target) < 0.02
        ) {
          this.camera.position.copy(this.cameraTransition.camPos);
          this.controls.target.copy(this.cameraTransition.target);
          this.cameraTransition = null;
        }
      } else if (this.isolatedPartId && this.isolatedMode !== 'none') {
        const b = this.jetbot.getPartBounding(this.isolatedPartId);
        if (b) {
          this.controls.target.lerp(b.center, Math.min(1, dt * 6));
        }
      }
      this.controls.update();
    }
  }

  private renderScene() {
    this.renderer.render(this.scene, this.camera);
  }

  private findRaycastComponent(clientX: number, clientY: number): { id: string; label: string } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.jetbot.rootGroup.children, true);

    for (const hit of intersects) {
      if (hit.object.userData?.isGuideVisual) continue;
      let curr: THREE.Object3D | null = hit.object;
      while (curr && curr !== this.jetbot.rootGroup) {
        if (curr.userData && curr.userData.id) {
          return {
            id: curr.userData.id,
            label: curr.userData.label || curr.userData.id,
          };
        }
        curr = curr.parent;
      }
    }
    return null;
  }

  private onPointerDown = (event: MouseEvent) => {
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  };

  // Pointer Up selects 3D component only on genuine click (< 6px drag) so orbit drags never hijack tabs
  private onPointerUp = (event: MouseEvent) => {
    if (!this.pointerDownPos) return;
    const dist = Math.hypot(event.clientX - this.pointerDownPos.x, event.clientY - this.pointerDownPos.y);
    this.pointerDownPos = null;
    if (dist >= 6) return;

    const hit = this.findRaycastComponent(event.clientX, event.clientY);
    if (hit) {
      soundEngine.playClick();
      this.callbacks.onComponentSelect(hit.id);
    }
  };

  // Pointer Move for Interactive 3D Cursor & Component Hover
  private onPointerMove = (event: MouseEvent) => {
    if (this.isDestroyed || !this.renderer) return;
    const hit = this.findRaycastComponent(event.clientX, event.clientY);
    if (hit) {
      this.container.style.cursor = 'pointer';
      if (this.callbacks.onComponentHover) {
        this.callbacks.onComponentHover({
          id: hit.id,
          nameVi: hit.label,
          clientX: event.clientX,
          clientY: event.clientY,
        });
      }
      return;
    }

    this.container.style.cursor = 'default';
    if (this.callbacks.onComponentHover) {
      this.callbacks.onComponentHover(null);
    }
  };

  // Real-time 3D to Screen Hotspot Projections (active when anatomy overlay is shown)
  private updateHotspots = () => {
    if (!this.callbacks.onHotspotsUpdate || !this.hotspotsActive || this.isDestroyed || !this.container) return;

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;

    const parts = [
      { id: 'wheels', nameVi: '1. Bánh Xe & TT Motor' },
      { id: 'motorBoard', nameVi: '2. Mạch Waveshare' },
      { id: 'jetson', nameVi: '3. NVIDIA Jetson Nano' },
      { id: 'ports', nameVi: '4. Cổng Kết Nối & GPIO' },
      { id: 'lidar', nameVi: '5. Cảm Biến RPLIDAR' },
      { id: 'camera', nameVi: '6. Camera Sony 8MP' },
      { id: 'antennas', nameVi: '7. Anten Kép SMA' },
    ];

    const hotspots: ComponentHotspot[] = [];
    const tempVec = new THREE.Vector3();
    const worldCenter = new THREE.Vector3();

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.id === 'wheels') {
        // Anchor pin directly on the Left Wheel tire/rim so bilateral wheel explosion is unmistakable
        this.jetbot.leftWheel.updateMatrixWorld(true);
        this.jetbot.leftWheel.getWorldPosition(worldCenter);
      } else {
        const b = this.jetbot.getPartBounding(p.id);
        if (!b) continue;
        worldCenter.copy(b.center);
      }

      tempVec.copy(worldCenter);
      tempVec.project(this.camera);

      const isFacing = tempVec.z < 1 && tempVec.z > -1;
      const screenX = ((tempVec.x + 1) / 2) * w;
      const screenY = ((-tempVec.y + 1) / 2) * h;
      const dist = this.camera.position.distanceTo(worldCenter);

      hotspots.push({
        id: p.id,
        nameVi: p.nameVi,
        index: i + 1,
        screenX,
        screenY,
        visible: isFacing && screenX >= -20 && screenX <= w + 20 && screenY >= -20 && screenY <= h + 20,
        distance: dist,
      });
    }

    const sig = hotspots
      .map((hs) => `${hs.id}:${Math.round(hs.screenX)},${Math.round(hs.screenY)},${hs.visible ? 1 : 0}`)
      .join('|');
    if (sig !== this.lastHotspotsSignature) {
      this.lastHotspotsSignature = sig;
      this.callbacks.onHotspotsUpdate(hotspots);
    }
  };

  private onResize = () => {
    if (!this.container || this.isDestroyed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // Public Control APIs
  public setDriveDirection(dir: DriveDirection) {
    this.driveDir = dir;
    this.driveInputs = {
      forward: dir === 'forward',
      backward: dir === 'backward',
      left: dir === 'left',
      right: dir === 'right',
    };
    if (dir !== 'stop') {
      soundEngine.startMotorSound();
    }
  }

  public setDriveInputs(inputs: Partial<DriveInputs>) {
    this.driveInputs = { ...this.driveInputs, ...inputs };
    const isMoving =
      this.driveInputs.forward ||
      this.driveInputs.backward ||
      this.driveInputs.left ||
      this.driveInputs.right;
    if (isMoving) {
      soundEngine.startMotorSound();
    }
  }

  public setSpeedPercent(pct: number) {
    this.speedPercent = pct;
  }

  public setAutopilot(active: boolean) {
    this.isAutopilot = active;
    if (active) {
      this.isLineFollower = false;
      this.driveDir = 'stop';
      this.avoidanceMemory = createInitialAvoidanceMemory();
      soundEngine.startMotorSound();
    }
  }

  public setLineFollower(active: boolean) {
    this.isLineFollower = active;
    if (active) {
      this.isAutopilot = false;
      this.driveDir = 'stop';
      this.lineFollowerState = { prevLateralError: 0, travelDir: 0 };
      soundEngine.startMotorSound();
    }
  }

  public setLineTrack(trackId: LineTrackId, warpToTrack = false) {
    this.selectedLineTrack = trackId;
    this.lineFollowerState = { prevLateralError: 0, travelDir: 0 };
    if (warpToTrack && trackId !== 'auto') {
      const spawn = GROUND_TRACK_LOOPS[trackId].spawn;
      this.robotPos.set(spawn.x, 0, spawn.z);
      this.robotHeading = spawn.heading;
      this.jetbot.rootGroup.position.copy(this.robotPos);
      this.jetbot.rootGroup.rotation.y = this.robotHeading;
      this.updateShadow(this.robotPos);
      this.lastActiveTrackId = trackId;

      if (this.cameraMode === 'orbit') {
        const targetCenter = this.robotPos.clone().add(new THREE.Vector3(0, 0.45, 0));
        this.controls.target.copy(targetCenter);
        this.camera.position.set(this.robotPos.x - 3.6, this.robotPos.y + 3.2, this.robotPos.z - 3.6);
        this.camera.lookAt(targetCenter);
        this.controls.update();
      }
      soundEngine.playClick();
    }
  }

  public getLineTrack(): LineTrackId {
    return this.selectedLineTrack;
  }

  public setExplodedView(progress: number) {
    this.targetExplode = Math.max(0, Math.min(1, progress));
  }

  public setCameraView(mode: CameraViewMode) {
    this.cameraMode = mode;
    if (mode === 'orbit') {
      this.controls.enabled = true;
      this.targetFov = 48;
      const currentDist = this.camera.position.distanceTo(this.robotPos);
      if (currentDist < 2.0 || currentDist > 20.0) {
        this.camera.position.set(this.robotPos.x + 2.45, this.robotPos.y + 2.25, this.robotPos.z + 3.25);
      }
      this.controls.target.copy(this.robotPos.clone().add(new THREE.Vector3(0, 0.55, 0)));
    } else if (mode === 'cinematic') {
      const dx = this.camera.position.x - this.robotPos.x;
      const dz = this.camera.position.z - this.robotPos.z;
      this.cinematicAngle = Math.atan2(dx, dz);
    }
  }

  public cycleCamera(): CameraViewMode {
    const modes: CameraViewMode[] = ['orbit', 'chase', 'fpv', 'top', 'wheel', 'lidar', 'cinematic'];
    const idx = modes.indexOf(this.cameraMode);
    const nextMode = modes[(idx + 1) % modes.length];
    this.setCameraView(nextMode);
    return nextMode;
  }

  public getCameraView(): CameraViewMode {
    return this.cameraMode;
  }

  public resetRobotPosition() {
    this.robotPos.set(0, 0, 0);
    this.robotHeading = 0;
    this.avoidanceMemory = createInitialAvoidanceMemory();
    this.lineFollowerState = { prevLateralError: 0, travelDir: 0 };
    this.jetbot.rootGroup.position.set(0, 0, 0);
    this.jetbot.rootGroup.rotation.y = 0;
    this.updateShadow(this.robotPos);
    this.setCameraView('orbit');
  }

  // ==========================================
  // 3D MODEL STUDIO APIS
  // ==========================================

  public setRenderStyle(style: RenderShaderStyle) {
    this.jetbot.setRenderStyle(style);
  }

  public setChassisColor(hex: number) {
    this.jetbot.setChassisColor(hex);
  }

  public setPartVisibility(partId: string, visible: boolean) {
    this.jetbot.setPartVisibility(partId, visible);
  }

  public setDimensionsVisible(visible: boolean) {
    this.jetbot.setDimensionsVisible(visible);
  }

  public setModelVariant(variant: ModelVariant) {
    this.jetbot.setVariant(variant);
  }

  public getMeshStats(): { vertices: number; triangles: number; meshes: number } {
    return this.jetbot.getMeshStats();
  }

  public setHotspotsEnabled(enabled: boolean) {
    this.hotspotsActive = enabled;
    if (enabled) {
      this.lastHotspotsSignature = '';
    }
  }

  public setInspectionOrbitRange(allowUnderview: boolean) {
    this.controls.maxPolarAngle = allowUnderview ? Math.PI * 0.66 : Math.PI / 2 - 0.02;
  }

  public setAutoRotate(enabled: boolean, speed = 1.0) {
    this.autoRotateEnabled = enabled;
    this.autoRotateSpeed = speed;
    if (!enabled) {
      this.turntableAngle = 0;
      this.jetbot.rootGroup.rotation.y = this.robotHeading;
    }
  }

  public resetTurntableHeading() {
    this.autoRotateEnabled = false;
    this.turntableAngle = 0;
    this.jetbot.rootGroup.rotation.y = this.robotHeading;
  }

  public setHighlightedPart(partId: string | null) {
    this.jetbot.setHighlightedPart(partId);
  }

  public setPresetView(view: 'isometric' | 'top' | 'front' | 'side' | 'bottom') {
    this.cameraMode = 'orbit';
    this.controls.enabled = true;
    this.controls.maxPolarAngle = Math.PI * 0.66;
    this.targetFov = 46;

    const exp = Math.max(this.currentExplode, this.targetExplode);
    const center = this.robotPos.clone().add(new THREE.Vector3(0, 0.55 + exp * 0.45, 0));
    const scale = 1 + exp * 0.25;
    let camPos: THREE.Vector3;

    if (view === 'isometric') {
      camPos = center.clone().add(new THREE.Vector3(2.85 * scale, 1.75 * scale, 2.85 * scale));
    } else if (view === 'top') {
      camPos = center.clone().add(new THREE.Vector3(0, 4.15 * scale, 0.08));
    } else if (view === 'front') {
      camPos = center.clone().add(new THREE.Vector3(0, 0.35, 3.25 * scale));
    } else if (view === 'side') {
      camPos = center.clone().add(new THREE.Vector3(3.25 * scale, 0.35, 0));
    } else {
      camPos = new THREE.Vector3(
        this.robotPos.x + 1.85 * scale,
        0.12,
        this.robotPos.z + 1.85 * scale
      );
    }

    this.cameraTransition = { camPos, target: center };
  }

  public focusOnComponent(partId: string | null, mode: 'solo' | 'ghost' | 'none' = 'ghost') {
    this.isolatedPartId = partId;
    this.isolatedMode = mode;
    this.jetbot.isolatePart(partId, mode);
    this.jetbot.setHighlightedPart(partId);

    if (partId) {
      // Snap currentExplode if close or read live bounding after updating world matrix
      const b = this.jetbot.getPartBounding(partId);
      if (b) {
        this.cameraMode = 'orbit';
        this.controls.enabled = true;
        this.targetFov = 38;
        const dist = Math.max(0.95, b.radius * 2.35);
        const camPos = b.center.clone().add(new THREE.Vector3(dist * 0.72, dist * 0.52, dist * 0.85));
        this.cameraTransition = { camPos, target: b.center.clone() };
      }
    } else {
      this.isolatedPartId = null;
      this.isolatedMode = 'none';
      this.cameraMode = 'orbit';
      this.controls.enabled = true;
      this.targetFov = 48;
      const exp = Math.max(this.currentExplode, this.targetExplode);
      const center = this.robotPos.clone().add(new THREE.Vector3(0, 0.58 + exp * 0.64, 0));
      const scale = 1 + exp * 0.45;
      const camPos = center.clone().add(new THREE.Vector3(3.15 * scale, 1.85 * scale, 3.35 * scale));
      this.cameraTransition = { camPos, target: center };
    }
  }

  public teleportToZone(zoneId: MapZoneId) {
    const zone = MAP_ZONES.find((z) => z.id === zoneId) || MAP_ZONES[0];
    this.robotPos.set(zone.spawnPos.x, zone.spawnPos.y, zone.spawnPos.z);
    this.robotHeading = zone.spawnPos.heading;
    this.jetbot.rootGroup.position.copy(this.robotPos);
    this.jetbot.rootGroup.rotation.y = this.robotHeading;
    this.updateShadow(this.robotPos);

    this.driveDir = 'stop';
    this.driveInputs = { forward: false, backward: false, left: false, right: false };
    this.avoidanceMemory = createInitialAvoidanceMemory();
    this.lineFollowerState = { prevLateralError: 0, travelDir: 0 };
    this.activeLinearVel = 0;
    this.activeAngularVel = 0;
    this.leftRpm = 0;
    this.rightRpm = 0;

    // Reposition camera smoothly to focus on the new zone
    const targetCenter = this.robotPos.clone().add(new THREE.Vector3(0, 0.45, 0));
    this.controls.target.copy(targetCenter);
    this.camera.position.set(this.robotPos.x, this.robotPos.y + 4.2, this.robotPos.z - 5.8);
    this.camera.lookAt(targetCenter);
    this.controls.update();

    soundEngine.playClick();
  }

  public toggleHeadlights(): boolean {
    this.headlightsEnabled = !this.headlightsEnabled;
    this.jetbot.setHeadlights(this.headlightsEnabled);
    soundEngine.playClick();
    return this.headlightsEnabled;
  }

  public getHeadlightsState(): boolean {
    return this.headlightsEnabled;
  }

  public toggleLaserBeam(): boolean {
    this.laserBeamEnabled = !this.laserBeamEnabled;
    this.jetbot.setLaserBeamVisible(this.laserBeamEnabled);
    soundEngine.playClick();
    return this.laserBeamEnabled;
  }

  public getLaserBeamState(): boolean {
    return this.laserBeamEnabled;
  }

  public setEnvironmentTheme(theme: EnvironmentTheme) {
    this.currentTheme = theme;
    this.arena.setTheme(theme);

    if (theme === 'daylight_city') {
      this.keyLight.color.setHex(0xfff7e6);
      this.keyLight.intensity = 2.85;
      this.hemiLight.color.setHex(0xe0f2fe);
      this.hemiLight.groundColor.setHex(0x334155);
      this.hemiLight.intensity = 1.15;
      this.rimLight.intensity = 0.65;
      this.scene.environmentIntensity = 0.72;
      this.renderer.toneMappingExposure = 1.08;
    } else if (theme === 'night_drive') {
      this.keyLight.color.setHex(0x93c5fd);
      this.keyLight.intensity = 0.8;
      this.hemiLight.color.setHex(0x1e3a8a);
      this.hemiLight.groundColor.setHex(0x020617);
      this.hemiLight.intensity = 0.48;
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity = 1.35;
      this.scene.environmentIntensity = 0.25;
      this.renderer.toneMappingExposure = 1.02;
    } else {
      // cyber_lab
      this.keyLight.color.setHex(0xfff4e0);
      this.keyLight.intensity = 1.65;
      this.hemiLight.color.setHex(0x7dd3fc);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.72;
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity = 1.15;
      this.scene.environmentIntensity = 0.42;
      this.renderer.toneMappingExposure = 1.02;
    }
    soundEngine.playClick();
  }

  public getEnvironmentTheme(): EnvironmentTheme {
    return this.currentTheme;
  }

  public captureSnapshot(): string {
    this.renderScene();
    return this.renderer.domElement.toDataURL('image/png');
  }


  public destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.onResize);
    this.controls.removeEventListener('start', this.onControlsStart);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

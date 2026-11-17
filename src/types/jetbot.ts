/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LineTrackId = 'auto' | 'roundabout' | 'race_track' | 'warehouse_agv';

export type AutoStatusCode =
  | 'MANUAL'
  | 'CLEAR'
  | 'CAUTIOUS'
  | 'AVOIDING_LEFT'
  | 'AVOIDING_RIGHT'
  | 'BACKUP_PIVOT'
  | 'LINE_LOCKED'
  | 'LINE_ACQUIRING'
  | 'LINE_OBSTACLE_AVOID';

export interface TelemetryData {
  leftMotorSpeed: number; // RPM (-200 to +200)
  rightMotorSpeed: number; // RPM (-200 to +200)
  linearVelocity: number; // m/s
  angularVelocity: number; // rad/s
  batteryVoltage: number; // Volts (e.g. 12.4V)
  batteryPercent: number; // 0 - 100%
  wifiSignalDbm: number; // e.g. -42 dBm
  cpuTemp: number; // Celsius
  gpuUsage: number; // %
  closestObstacleDist: number; // meters
  headingDeg: number; // 0 - 360 degrees
  currentMode: 'manual' | 'obstacle_avoidance' | 'line_follower';
  posX: number; // Arena X position in meters
  posZ: number; // Arena Z position in meters
  autoStatus?: AutoStatusCode;
  targetGapDeg?: number;
  lineError?: number; // -1 (left) to +1 (right)
  lineDetected?: boolean;
  lineConfidence?: number; // 0 - 100%
  activeTrackId?: Exclude<LineTrackId, 'auto'>;
}

export type EnvironmentTheme = 'cyber_lab' | 'daylight_city' | 'night_drive';

export type MapZoneId = 'dock' | 'city' | 'track' | 'warehouse' | 'maze';

export interface MapZoneInfo {
  id: MapZoneId;
  nameVi: string;
  nameEn: string;
  tag: string;
  description: string;
  spawnPos: { x: number; y: number; z: number; heading: number };
  color: string;
}

export type DriveDirection = 'forward' | 'backward' | 'left' | 'right' | 'stop';

export interface DriveInputs {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export type CameraViewMode =
  | 'orbit'
  | 'chase'
  | 'fpv'
  | 'top'
  | 'wheel'
  | 'lidar'
  | 'cinematic';

export interface LidarScanPoint {
  angleDeg: number;
  distance: number;
}

export type ActiveTab = 'sim' | 'model3d' | 'anatomy' | 'sensors' | 'cmu';

export type RenderShaderStyle = 'pbr' | 'wireframe' | 'xray' | 'clay' | 'thermal';

export type ModelVariant = 'rplidar' | 'standard' | 'stereo';

export interface Model3DOptions {
  renderStyle: RenderShaderStyle;
  chassisColor: string;
  autoRotate: boolean;
  autoRotateSpeed: number;
  showDimensions: boolean;
  showWireframeMesh: boolean;
  modelVariant: ModelVariant;
  visibleParts: {
    wheels: boolean;
    motorBoard: boolean;
    jetsonNano: boolean;
    ports: boolean;
    lidar: boolean;
    camera: boolean;
    antennas: boolean;
    stereo?: boolean;
  };
}

export interface DimensionInfo {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  wheelTrackMm: number;
  wheelDiameterMm: number;
  groundClearanceMm: number;
  weightGrams: number;
  verticesCount: number;
  trianglesCount: number;
}

export type ComponentViewMode = 'assembly' | 'exploded' | 'ghost' | 'solo';

export interface JetBotComponentInfo {
  id: string;
  name: string;
  nameVi: string;
  category: 'mechanical' | 'electronic' | 'sensor' | 'compute';
  description: string;
  functions: string[];
  aiRole: string;
  hardwareInterface: {
    protocol: string;
    pinout: string;
    voltage: string;
    powerConsumption: string;
  };
  rosNode: {
    packageName: string;
    launchCommand: string;
    topics: string[];
  };
  practicalNotes: string;
  specs: Record<string, string>;
  explodeOffset: { x: number; y: number; z: number };
  realPhotos?: Array<{
    url: string;
    caption: string;
    perspective: string;
  }>;
}

export interface ComponentHotspot {
  id: string;
  nameVi: string;
  index: number;
  screenX: number;
  screenY: number;
  visible: boolean;
  distance: number;
}


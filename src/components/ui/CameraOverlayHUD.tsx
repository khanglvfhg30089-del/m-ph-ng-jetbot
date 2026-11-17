/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  RotateCw,
  Video,
  Camera,
  Eye,
  Disc3,
  Radar,
  Film,
  Compass,
  Crosshair,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import { CameraViewMode, TelemetryData } from '../../types/jetbot';

interface CameraOverlayHUDProps {
  cameraMode: CameraViewMode;
  onCameraChange: (mode: CameraViewMode) => void;
  telemetry: TelemetryData;
  onResetCamera?: () => void;
}

interface CameraOption {
  id: CameraViewMode;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  keyNumber: string;
  description: string;
}

const CAMERA_OPTIONS: CameraOption[] = [
  {
    id: 'orbit',
    label: 'Xoay Tự Do (Orbit 360°)',
    shortLabel: 'Orbit',
    icon: RotateCw,
    keyNumber: '1',
    description: 'Xoay và phóng to/thu nhỏ tự do quanh JetBot',
  },
  {
    id: 'chase',
    label: 'Bám Đuôi (Chase Cam)',
    shortLabel: 'Bám Đuôi',
    icon: Video,
    keyNumber: '2',
    description: 'Góc nhìn thứ 3 bám theo sau xe mượt mà',
  },
  {
    id: 'fpv',
    label: 'Mắt Camera CSI (FPV AI)',
    shortLabel: 'FPV Mắt AI',
    icon: Camera,
    keyNumber: '3',
    description: 'Góc nhìn thứ nhất từ ống kính 8MP góc rộng',
  },
  {
    id: 'top',
    label: 'Từ Trên Cao (Top-Down)',
    shortLabel: 'Trên Cao',
    icon: Eye,
    keyNumber: '4',
    description: 'Nhìn trực diện bản đồ mặt sàn và vật cản',
  },
  {
    id: 'wheel',
    label: 'Bánh Xe Sát Đất (Wheel Cam)',
    shortLabel: 'Bánh Xe',
    icon: Disc3,
    keyNumber: '5',
    description: 'Quan sát sát mặt đất vành mâm xanh & lốp gai',
  },
  {
    id: 'lidar',
    label: 'Tháp Laser (RPLIDAR Cam)',
    shortLabel: 'Tháp Laser',
    icon: Radar,
    keyNumber: '6',
    description: 'Góc nhìn từ tháp quét laser 360 độ trên cùng',
  },
  {
    id: 'cinematic',
    label: 'Điện Ảnh (Cinematic Studio)',
    shortLabel: 'Điện Ảnh',
    icon: Film,
    keyNumber: '7',
    description: 'Tự động lượn vòng 360° chiêm ngưỡng xe',
  },
];

export const CameraOverlayHUD: React.FC<CameraOverlayHUDProps> = ({
  cameraMode,
  onCameraChange,
  telemetry,
  onResetCamera,
}) => {
  const activeOption = CAMERA_OPTIONS.find((c) => c.id === cameraMode) || CAMERA_OPTIONS[0];

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none flex flex-col justify-between">
      {/* 1. TOP FLOATING CAMERA SELECTION BAR */}
      <div className="p-2.5 flex items-center justify-between gap-2 pointer-events-auto">
        {/* Multi-angle Pill Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/95 border border-slate-800/90 rounded-2xl p-1 shadow-2xl max-w-full overflow-x-auto scrollbar-none">
          <div className="hidden lg:flex items-center px-2 py-1 text-[11px] font-bold text-slate-400 border-r border-slate-800 mr-1 space-x-1 shrink-0">
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Góc Nhìn</span>
          </div>

          {CAMERA_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = cameraMode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onCameraChange(opt.id)}
                title={`${opt.label} (Phím ${opt.keyNumber})`}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-slate-950 font-bold shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/50'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">{opt.shortLabel}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                    isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {opt.keyNumber}
                </span>
              </button>
            );
          })}

          {onResetCamera && (
            <button
              onClick={onResetCamera}
              className="ml-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-[11px] font-semibold text-slate-200 transition shrink-0 border-l border-slate-700/60"
              title="Căn lại vị trí & góc nhìn mặc định"
            >
              Reset
            </button>
          )}
        </div>

        {/* View Details Badge (Shown only on wide 2XL displays so it never wraps over panels) */}
        <div className="hidden 2xl:flex items-center space-x-2 bg-slate-900/92 border border-slate-800/80 px-3 py-1.5 rounded-xl text-xs text-slate-300 shrink-0">
          <span className="text-emerald-400 font-semibold flex items-center">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {activeOption.label}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 text-[11px]">{activeOption.description}</span>
        </div>
      </div>

      {/* 2. CONTEXTUAL VIEWPORT HUD OVERLAYS */}

      {/* (A) FPV MODE: AUTHENTIC CSI AI VISION HUD */}
      {cameraMode === 'fpv' && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
          {/* Top HUD Telemetry */}
          <div className="flex items-center justify-between font-mono text-[11px] text-emerald-400 bg-slate-950/85 p-2 rounded-xl border border-emerald-500/30 mx-auto max-w-xl w-full">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="font-bold text-white">CSI 8MP LIVE</span>
              <span className="text-emerald-300/70">160° ULTRA-WIDE</span>
            </div>
            <div className="flex items-center space-x-3">
              <span>HD 1280x720</span>
              <span>60 FPS</span>
              <span className="text-cyan-400">YOLOv8 CUDA</span>
            </div>
          </div>

          {/* Center Targeting Reticle */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Center Crosshair */}
            <div className="relative w-28 h-28 border border-emerald-500/40 rounded-full flex items-center justify-center">
              <Crosshair className="w-8 h-8 text-emerald-400 opacity-60" />
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400"></div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400"></div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400"></div>
            </div>

            {/* Dynamic Bounding Box driven by live LiDAR & CSI Line Telemetry */}
            {(telemetry.closestObstacleDist < 3.0 || telemetry.currentMode === 'line_follower') && (
              <div
                className={`absolute border rounded px-1.5 py-0.5 text-[10px] font-mono pointer-events-none transition-all duration-150 ${
                  telemetry.closestObstacleDist < 1.2
                    ? 'border-red-400/90 bg-red-500/15 text-red-200'
                    : 'border-cyan-400/85 bg-cyan-500/10 text-cyan-200'
                }`}
                style={{
                  top: telemetry.currentMode === 'line_follower' ? '56%' : '42%',
                  left: `${50 + (telemetry.currentMode === 'line_follower' ? (telemetry.lineError ?? 0) * 14 : 0)}%`,
                  transform: 'translate(-50%, 0)',
                  width: '175px',
                  height: '95px',
                }}
              >
                <div className="flex justify-between items-center bg-slate-950/85 px-1.5 py-0.5 rounded text-[9px]">
                  <span>
                    {telemetry.closestObstacleDist < 1.2
                      ? `VẬT CẢN (${telemetry.closestObstacleDist}m)`
                      : telemetry.currentMode === 'line_follower'
                      ? 'VẠCH ĐƯỜNG'
                      : `CẢN (${telemetry.closestObstacleDist}m)`}
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {telemetry.currentMode === 'line_follower' ? `${telemetry.lineConfidence ?? 0}%` : '97.2%'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Heading Compass + 5D Elevation/Pitch */}
          <div className="mx-auto flex items-center space-x-4 bg-slate-950/90 px-4 py-1.5 rounded-full border border-emerald-500/30 text-xs font-mono text-emerald-300">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span>GÓC LA BÀN: <strong className="text-white">{telemetry.headingDeg}°</strong></span>
            <span>VẬN TỐC: <strong className="text-white">{telemetry.linearVelocity} m/s</strong></span>
            <span>ĐỘ DỐC: <strong className="text-cyan-300">{telemetry.pitchDeg ?? 0}°</strong></span>
          </div>
        </div>
      )}

      {/* (B) WHEEL MODE: LOW-STANCE SUSPENSION & RIM HUD */}
      {cameraMode === 'wheel' && (
        <div className="absolute bottom-6 left-6 pointer-events-none bg-slate-900/95 border border-blue-500/30 p-3 rounded-2xl shadow-xl max-w-xs text-xs font-mono">
          <div className="flex items-center space-x-2 text-blue-400 font-bold mb-2">
            <Disc3 className="w-4 h-4" />
            <span>CƠ CẤU BÁNH XE & VÀNH MÂM</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Vành Mâm:</span>
              <span className="text-blue-400 font-bold">Metallic Blue Anodized</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Động cơ Trái:</span>
              <span className="text-emerald-400 font-bold">{telemetry.leftMotorSpeed} RPM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Động cơ Phải:</span>
              <span className="text-emerald-400 font-bold">{telemetry.rightMotorSpeed} RPM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Độ bám mặt sàn:</span>
              <span className="text-cyan-400 font-bold">{telemetry.surfaceGrip ?? 99}% (5D Physics)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cao độ / Độ dốc:</span>
              <span className="text-amber-300 font-bold">
                {(telemetry.elevationY ?? 0).toFixed(2)}m / {telemetry.pitchDeg ?? 0}°
              </span>
            </div>
          </div>
        </div>
      )}

      {/* (C) LIDAR MODE: 360° LASER SCANNER TURRET HUD */}
      {cameraMode === 'lidar' && (
        <div className="absolute bottom-6 right-6 pointer-events-none bg-slate-900/95 border border-cyan-500/30 p-3 rounded-2xl shadow-xl max-w-xs text-xs font-mono">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold mb-2">
            <Radar className="w-4 h-4 text-cyan-400" />
            <span>RPLIDAR A1 LASER TURRET</span>
          </div>
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Tần số quét:</span>
              <span className="text-cyan-300 font-bold">10 Hz (600 RPM)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tầm quét 360°:</span>
              <span className="text-emerald-400 font-bold">12.0m Radius</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vật cản gần nhất:</span>
              <span className="text-amber-400 font-bold">{telemetry.closestObstacleDist} m</span>
            </div>
          </div>
        </div>
      )}

      {/* (D) CINEMATIC MODE: STUDIO TURNTABLE BADGE */}
      {cameraMode === 'cinematic' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none bg-slate-950/92 border border-emerald-500/40 px-4 py-2 rounded-2xl shadow-2xl flex items-center space-x-2 text-xs font-mono">
          <Film className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 font-bold">STUDIO TURNTABLE 360°</span>
          <span className="text-slate-400">&bull; Đang tự động quay lượn điện ảnh</span>
        </div>
      )}

      {/* (E) TOP MODE: SLAM 2D ARENA MAPPER BADGE */}
      {cameraMode === 'top' && (
        <div className="absolute top-16 right-6 pointer-events-none bg-slate-900/95 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs font-mono flex items-center space-x-2">
          <Maximize2 className="w-4 h-4 text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-white font-bold">BẢN ĐỒ MẶT SÀN (TOP-DOWN)</span>
            <span className="text-slate-400 text-[10px]">Lưới toạ độ 1 ô = 1.0 mét</span>
          </div>
        </div>
      )}

    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Square,
  Wand2,
  Route,
  Camera,
  Layers,
  Gauge,
  Eye,
  Video,
  RotateCw,
  Disc3,
  Radar,
  Film,
} from 'lucide-react';
import { CameraViewMode, DriveDirection, DriveInputs, LineTrackId, TelemetryData } from '../../types/jetbot';

interface ControlDockProps {
  telemetry: TelemetryData;
  speedPercent: number;
  onSpeedChange: (speed: number) => void;
  onDriveStart: (dir: DriveDirection) => void;
  onDriveStop: () => void;
  onDriveInputs?: (inputs: Partial<DriveInputs>) => void;
  isAutopilot: boolean;
  onToggleAutopilot: () => void;
  isLineFollower: boolean;
  onToggleLineFollower: () => void;
  lineTrack?: LineTrackId;
  onSelectLineTrack?: (trackId: LineTrackId, warpToTrack?: boolean) => void;
  cameraMode: CameraViewMode;
  onCameraChange: (mode: CameraViewMode) => void;
  explodeProgress: number;
  onExplodeChange: (progress: number) => void;
  onOpenAnatomy?: () => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  telemetry,
  speedPercent,
  onSpeedChange,
  onDriveStart,
  onDriveStop,
  onDriveInputs,
  isAutopilot,
  onToggleAutopilot,
  isLineFollower,
  onToggleLineFollower,
  lineTrack = 'auto',
  onSelectLineTrack,
  cameraMode,
  onCameraChange,
  explodeProgress,
  onExplodeChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activePanel, setActivePanel] = useState<'drive' | 'camera' | 'explode'>('drive');

  const keysHeld = useRef<DriveInputs>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  // Keyboard shortcut listener (H to toggle dock, WASD/arrows with simultaneous multi-key support)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === 'h') {
        setIsCollapsed((prev) => !prev);
        return;
      }

      let stateChanged = false;
      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        if (!keysHeld.current.forward) { keysHeld.current.forward = true; stateChanged = true; }
      } else if (key === 's' || key === 'arrowdown') {
        e.preventDefault();
        if (!keysHeld.current.backward) { keysHeld.current.backward = true; stateChanged = true; }
      } else if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        if (!keysHeld.current.left) { keysHeld.current.left = true; stateChanged = true; }
      } else if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        if (!keysHeld.current.right) { keysHeld.current.right = true; stateChanged = true; }
      } else if (key === ' ' || key === 'escape') {
        e.preventDefault();
        keysHeld.current = { forward: false, backward: false, left: false, right: false };
        stateChanged = true;
      } else if (key === '1') {
        onCameraChange('orbit');
        return;
      } else if (key === '2') {
        onCameraChange('chase');
        return;
      } else if (key === '3') {
        onCameraChange('fpv');
        return;
      } else if (key === '4') {
        onCameraChange('top');
        return;
      } else if (key === '5') {
        onCameraChange('wheel');
        return;
      } else if (key === '6') {
        onCameraChange('lidar');
        return;
      } else if (key === '7') {
        onCameraChange('cinematic');
        return;
      } else if (key === 'c') {
        const modes: CameraViewMode[] = ['orbit', 'chase', 'fpv', 'top', 'wheel', 'lidar', 'cinematic'];
        const currentIdx = modes.indexOf(cameraMode);
        onCameraChange(modes[(currentIdx + 1) % modes.length]);
        return;
      }

      if (stateChanged) {
        if (onDriveInputs) {
          onDriveInputs({ ...keysHeld.current });
        } else {
          if (keysHeld.current.forward) onDriveStart('forward');
          else if (keysHeld.current.backward) onDriveStart('backward');
          else if (keysHeld.current.left) onDriveStart('left');
          else if (keysHeld.current.right) onDriveStart('right');
          else onDriveStop();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      let stateChanged = false;
      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        if (keysHeld.current.forward) { keysHeld.current.forward = false; stateChanged = true; }
      } else if (key === 's' || key === 'arrowdown') {
        e.preventDefault();
        if (keysHeld.current.backward) { keysHeld.current.backward = false; stateChanged = true; }
      } else if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        if (keysHeld.current.left) { keysHeld.current.left = false; stateChanged = true; }
      } else if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        if (keysHeld.current.right) { keysHeld.current.right = false; stateChanged = true; }
      }

      if (stateChanged) {
        if (onDriveInputs) {
          onDriveInputs({ ...keysHeld.current });
        } else {
          const isMoving = keysHeld.current.forward || keysHeld.current.backward || keysHeld.current.left || keysHeld.current.right;
          if (!isMoving) onDriveStop();
        }
      }
    };

    const handleBlur = () => {
      if (document.hasFocus()) return;
      keysHeld.current = { forward: false, backward: false, left: false, right: false };
      if (onDriveInputs) onDriveInputs({ ...keysHeld.current });
      onDriveStop();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onDriveInputs, onDriveStart, onDriveStop, onCameraChange, cameraMode]);

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 w-[95vw] max-w-3xl ${
        isCollapsed ? 'translate-y-[calc(100%-36px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapse / Expand Tab Handle */}
      <div className="flex justify-center mb-1">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center space-x-1 px-4 py-1 rounded-t-lg bg-slate-900 border-t border-x border-slate-700 text-xs font-semibold text-slate-300 hover:text-emerald-400 transition shadow-lg"
          title="Phím tắt: H"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mở Bảng Điều Khiển (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              <span>Thu Gọn Giao Diện (H)</span>
            </>
          )}
        </button>
      </div>

      {/* Main Bottom Dock Container */}
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3 text-slate-200">
        {/* Top bar with quick sub-tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActivePanel('drive')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activePanel === 'drive'
                  ? 'bg-emerald-600 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Lái & Tự Hành</span>
            </button>
            <button
              onClick={() => setActivePanel('camera')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activePanel === 'camera'
                  ? 'bg-emerald-600 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Góc Nhìn 3D</span>
            </button>
            <button
              onClick={() => setActivePanel('explode')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activePanel === 'explode'
                  ? 'bg-emerald-600 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Bóc Tách ({Math.round(explodeProgress * 100)}%)</span>
            </button>
          </div>

          {/* Quick status pill */}
          <div className="text-[11px] text-slate-400 hidden sm:flex items-center space-x-3">
            <span>
              Vận tốc: <strong className="text-emerald-400 font-mono font-bold">{telemetry.linearVelocity} m/s</strong>
            </span>
            <span>
              Góc hướng: <strong className="text-cyan-400 font-mono font-bold">{telemetry.headingDeg}°</strong>
            </span>
          </div>
        </div>

        {/* PANEL 1: DRIVE & AUTOPILOT */}
        {activePanel === 'drive' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Speed & Autonomous Toggles */}
            <div className="md:col-span-6 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400 mr-1.5" /> Tốc Độ Động Cơ:
                </span>
                <span className="font-mono text-emerald-400 font-bold">{speedPercent}% (PWM)</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={speedPercent}
                onChange={(e) => onSpeedChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />

              {/* Autopilot and Line Follower Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={onToggleAutopilot}
                  className={`flex items-center justify-center space-x-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition shadow-md ${
                    isAutopilot
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Tránh Cản LiDAR</span>
                  <span
                    className={`ml-1 text-[9px] px-1 py-0.2 rounded font-mono ${
                      isAutopilot ? 'bg-slate-950 text-emerald-400' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {isAutopilot ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  onClick={onToggleLineFollower}
                  className={`flex items-center justify-center space-x-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition shadow-md ${
                    isLineFollower
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Bám Vạch Tự Động</span>
                  <span
                    className={`ml-1 text-[9px] px-1 py-0.2 rounded font-mono ${
                      isLineFollower ? 'bg-slate-950 text-cyan-400' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {isLineFollower ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* Live Autonomous Status Strip (only visible when an autonomous controller is engaged) */}
              {isAutopilot && (
                <div className="bg-slate-950/90 border border-emerald-500/35 rounded-xl px-2.5 py-2 text-[10px] font-mono flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        telemetry.autoStatus === 'BACKUP_PIVOT'
                          ? 'bg-red-500'
                          : telemetry.autoStatus === 'AVOIDING_LEFT' || telemetry.autoStatus === 'AVOIDING_RIGHT'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span className="font-bold text-emerald-300">
                      {telemetry.autoStatus === 'BACKUP_PIVOT'
                        ? 'LÙI THOÁT CẢN'
                        : telemetry.autoStatus === 'AVOIDING_LEFT'
                        ? 'NÉ SANG TRÁI'
                        : telemetry.autoStatus === 'AVOIDING_RIGHT'
                        ? 'NÉ SANG PHẢI'
                        : telemetry.autoStatus === 'CAUTIOUS'
                        ? 'GIẢM TỐC THẬN TRỌNG'
                        : 'ĐƯỜNG THÔNG FTG'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400">
                    <span>
                      Khe hở: <strong className="text-cyan-300">{telemetry.targetGapDeg ?? 0}°</strong>
                    </span>
                    <span>
                      Cản: <strong className="text-amber-300">{telemetry.closestObstacleDist}m</strong>
                    </span>
                  </div>
                </div>
              )}

              {isLineFollower && (
                <div className="bg-slate-950/90 border border-cyan-500/35 rounded-xl px-2.5 py-2 text-[10px] space-y-1.5">
                  <div className="flex items-center justify-between font-mono">
                    <span
                      className={`font-bold ${
                        telemetry.autoStatus === 'LINE_OBSTACLE_AVOID'
                          ? 'text-red-400'
                          : telemetry.lineDetected
                          ? 'text-cyan-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {telemetry.autoStatus === 'LINE_OBSTACLE_AVOID'
                        ? 'DỪNG / NÉ VẬT CẢN TRÊN LINE'
                        : telemetry.lineDetected
                        ? 'ĐÃ KHÓA VẠCH PURE PURSUIT'
                        : 'ĐANG TIẾP CẬN VẠCH'}
                    </span>
                    <span className="text-emerald-400 font-bold">{telemetry.lineConfidence ?? 0}%</span>
                  </div>

                  {/* Line alignment meter */}
                  <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-500/70 -translate-x-1/2" />
                    <div
                      className={`absolute top-0 bottom-0 w-3 rounded-full -translate-x-1/2 transition-all duration-100 ${
                        telemetry.lineDetected ? 'bg-cyan-400' : 'bg-amber-400'
                      }`}
                      style={{
                        left: `${Math.max(8, Math.min(92, 50 + (telemetry.lineError ?? 0) * 42))}%`,
                      }}
                    />
                  </div>

                  {/* Quick Route Selector Pills */}
                  {onSelectLineTrack && (
                    <div className="flex items-center gap-1 pt-0.5">
                      {(
                        [
                          { id: 'auto', label: 'Tự Tìm' },
                          { id: 'roundabout', label: 'Vòng Xuyến' },
                          { id: 'race_track', label: 'Đường Đua' },
                          { id: 'warehouse_agv', label: 'Kho AGV' },
                        ] as { id: LineTrackId; label: string }[]
                      ).map((t) => {
                        const isSelected = lineTrack === t.id || (lineTrack === 'auto' && telemetry.activeTrackId === t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => onSelectLineTrack(t.id, t.id !== 'auto')}
                            className={`flex-1 py-0.5 px-1.5 rounded text-[9.5px] font-semibold border transition ${
                              isSelected
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/70'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Keyboard hint */}
              {!isAutopilot && !isLineFollower && (
                <p className="text-[10px] text-slate-400 hidden sm:block leading-relaxed">
                  Bàn phím: <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">W</kbd> tiến,{' '}
                  <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">S</kbd> lùi,{' '}
                  <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">A</kbd> rẽ trái,{' '}
                  <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">D</kbd> rẽ phải.{' '}
                  <span className="text-emerald-400 font-medium">Bấm đồng thời W+A / W+D để ôm cua mượt mà!</span>
                </p>
              )}
            </div>

            {/* D-Pad Buttons */}
            <div className="md:col-span-6 flex justify-center">
              <div className="grid grid-cols-3 gap-1.5 w-48">
                <div></div>
                <button
                  onMouseDown={() => {
                    onDriveStart('forward');
                    onDriveInputs?.({ forward: true, backward: false, left: false, right: false });
                  }}
                  onMouseUp={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  onMouseLeave={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  onTouchStart={() => {
                    onDriveStart('forward');
                    onDriveInputs?.({ forward: true, backward: false, left: false, right: false });
                  }}
                  onTouchEnd={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  title="Tiến Về Phía Trước (Phím W / Mũi Tên Lên)"
                  className="h-11 bg-slate-800 hover:bg-emerald-600 active:bg-emerald-700 text-slate-200 rounded-xl flex items-center justify-center border border-slate-700 shadow-md transition"
                >
                  <ChevronUp className="w-5 h-5 font-bold" />
                </button>
                <div></div>

                <button
                  onMouseDown={() => {
                    onDriveStart('left');
                    onDriveInputs?.({ forward: false, backward: false, left: true, right: false });
                  }}
                  onMouseUp={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  onMouseLeave={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  onTouchStart={() => {
                    onDriveStart('left');
                    onDriveInputs?.({ forward: false, backward: false, left: true, right: false });
                  }}
                  onTouchEnd={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  title="Xoay Bên Trái (Phím A / Mũi Tên Trái)"
                  className="h-11 bg-slate-800 hover:bg-emerald-600 active:bg-emerald-700 text-slate-200 rounded-xl flex items-center justify-center border border-slate-700 shadow-md transition"
                >
                  <ChevronLeft className="w-5 h-5 font-bold" />
                </button>

                <button
                  onClick={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  title="Dừng Khẩn Cấp (Phím Cách / Esc)"
                  className="h-11 bg-red-950/80 hover:bg-red-800 text-red-300 hover:text-white rounded-xl flex items-center justify-center text-xs font-bold border border-red-800/80 shadow-md transition"
                >
                  <Square className="w-4 h-4 fill-current mr-0.5" /> DỪNG
                </button>

                <button
                  onMouseDown={() => {
                    onDriveStart('right');
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: true });
                  }}
                  onMouseUp={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  onMouseLeave={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  onTouchStart={() => {
                    onDriveStart('right');
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: true });
                  }}
                  onTouchEnd={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  title="Xoay Bên Phải (Phím D / Mũi Tên Phải)"
                  className="h-11 bg-slate-800 hover:bg-emerald-600 active:bg-emerald-700 text-slate-200 rounded-xl flex items-center justify-center border border-slate-700 shadow-md transition"
                >
                  <ChevronRight className="w-5 h-5 font-bold" />
                </button>

                <div></div>
                <button
                  onMouseDown={() => {
                    onDriveStart('backward');
                    onDriveInputs?.({ forward: false, backward: true, left: false, right: false });
                  }}
                  onMouseUp={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  onMouseLeave={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  onTouchStart={() => {
                    onDriveStart('backward');
                    onDriveInputs?.({ forward: false, backward: true, left: false, right: false });
                  }}
                  onTouchEnd={() => {
                    onDriveStop();
                    onDriveInputs?.({ forward: false, backward: false, left: false, right: false });
                  }}
                  title="Lùi Về Sau (Phím S / Mũi Tên Xuống)"
                  className="h-11 bg-slate-800 hover:bg-emerald-600 active:bg-emerald-700 text-slate-200 rounded-xl flex items-center justify-center border border-slate-700 shadow-md transition"
                >
                  <ChevronDown className="w-5 h-5 font-bold" />
                </button>
                <div></div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: CAMERA VIEW SWITCHER */}
        {activePanel === 'camera' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              <button
                onClick={() => onCameraChange('orbit')}
                className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition text-center ${
                  cameraMode === 'orbit'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <RotateCw className="w-4 h-4" />
                <span className="text-[11px] font-semibold leading-tight">Xoay Tự Do</span>
                <span className="text-[9px] text-slate-400 opacity-80">(Phím 1)</span>
              </button>

              <button
                onClick={() => onCameraChange('chase')}
                className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition text-center ${
                  cameraMode === 'chase'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Video className="w-4 h-4" />
                <span className="text-[11px] font-semibold leading-tight">Bám Đuôi Xe</span>
                <span className="text-[9px] text-slate-400 opacity-80">(Phím 2)</span>
              </button>

              <button
                onClick={() => onCameraChange('fpv')}
                className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition text-center ${
                  cameraMode === 'fpv'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span className="text-[11px] font-semibold leading-tight">Mắt AI CSI</span>
                <span className="text-[9px] text-slate-400 opacity-80">(Phím 3)</span>
              </button>

              <button
                onClick={() => onCameraChange('top')}
                className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition text-center ${
                  cameraMode === 'top'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span className="text-[11px] font-semibold leading-tight">Từ Trên Cao</span>
                <span className="text-[9px] text-slate-400 opacity-80">(Phím 4)</span>
              </button>

              <button
                onClick={() => onCameraChange('wheel')}
                className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition text-center ${
                  cameraMode === 'wheel'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Disc3 className="w-4 h-4" />
                <span className="text-[11px] font-semibold leading-tight">Bánh Xe & Sàn</span>
                <span className="text-[9px] text-slate-400 opacity-80">(Phím 5)</span>
              </button>

              <button
                onClick={() => onCameraChange('lidar')}
                className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition text-center ${
                  cameraMode === 'lidar'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Radar className="w-4 h-4" />
                <span className="text-[11px] font-semibold leading-tight">Tháp Laser</span>
                <span className="text-[9px] text-slate-400 opacity-80">(Phím 6)</span>
              </button>

              <button
                onClick={() => onCameraChange('cinematic')}
                className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition text-center ${
                  cameraMode === 'cinematic'
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-bold border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Film className="w-4 h-4" />
                <span className="text-[11px] font-semibold leading-tight">Điện Ảnh Studio</span>
                <span className="text-[9px] text-slate-400 opacity-80">(Phím 7)</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center pt-1">
              Nhấn phím <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-emerald-400 font-mono">1 - 7</kbd> hoặc phím <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-cyan-400 font-mono">C</kbd> trên bàn phím để chuyển đổi tức thời giữa các góc nhìn!
            </p>
          </div>
        )}

        {/* PANEL 3: EXPLODED VIEW SLIDER */}
        {activePanel === 'explode' && (
          <div className="space-y-3 p-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300 flex items-center">
                <Layers className="w-4 h-4 text-emerald-400 mr-2" />
                Mức Độ Bóc Tách Các Tầng Linh Kiện (Exploded View):
              </span>
              <span className="font-mono text-emerald-400 font-bold text-sm">
                {Math.round(explodeProgress * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={explodeProgress}
              onChange={(e) => onExplodeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <button
                onClick={() => onExplodeChange(0)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                0% Lắp Ráp Hoàn Chỉnh
              </button>
              <button
                onClick={() => onExplodeChange(0.5)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                50% Tách Tầng Vừa
              </button>
              <button
                onClick={() => onExplodeChange(1)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                100% Bóc Tách Tối Đa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

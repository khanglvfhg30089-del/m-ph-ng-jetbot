/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CloudRain,
  Wind,
  SunMedium,
  Clock,
  Bot,
  Activity,
  ScanEye,
  ChevronDown,
  ChevronUp,
  Mountain,
  Gauge,
} from 'lucide-react';
import { TelemetryData, TimeScaleOption, WeatherType } from '../../types/jetbot';

interface Sim5DPanelProps {
  weather: WeatherType;
  timeScale: TimeScaleOption;
  dynamicTraffic: boolean;
  hapticFeedback: boolean;
  thermalHud: boolean;
  telemetry: TelemetryData;
  onSelectWeather: (weather: WeatherType) => void;
  onSelectTimeScale: (scale: TimeScaleOption) => void;
  onToggleDynamicTraffic: () => void;
  onToggleHapticFeedback: () => void;
  onToggleThermalHud: () => void;
}

export const Sim5DPanel: React.FC<Sim5DPanelProps> = ({
  weather,
  timeScale,
  dynamicTraffic,
  hapticFeedback,
  thermalHud,
  telemetry,
  onSelectWeather,
  onSelectTimeScale,
  onToggleDynamicTraffic,
  onToggleHapticFeedback,
  onToggleThermalHud,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const elevationY = telemetry.elevationY ?? 0;
  const pitchDeg = telemetry.pitchDeg ?? 0;
  const surfaceGrip = telemetry.surfaceGrip ?? 99;

  return (
    <div className="absolute top-16 left-3 z-30 pointer-events-auto select-none flex flex-col items-start">
      <div className="w-60 sm:w-64 bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden">
        {/* Compact Accordion Header */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 flex items-center justify-between bg-slate-950/70 hover:bg-slate-800/70 border-b border-slate-800/80 transition text-left"
        >
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100">
              Mô Phỏng 5D & Địa Hình
            </span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isOpen && (
          <div className="p-2.5 space-y-2.5 text-xs">
            {/* Live 5D Elevation, Pitch & Surface Grip Readout */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950/90 border border-slate-800 rounded-xl p-1.5 font-mono text-[10px]">
              <div className="flex flex-col items-center">
                <span className="text-slate-400 flex items-center space-x-0.5">
                  <Mountain className="w-2.5 h-2.5 text-orange-400" />
                  <span>Cao Y</span>
                </span>
                <span className="text-orange-300 font-bold">{elevationY.toFixed(2)}m</span>
              </div>
              <div className="flex flex-col items-center border-x border-slate-800">
                <span className="text-slate-400">Độ Dốc</span>
                <span className="text-cyan-300 font-bold">
                  {pitchDeg > 0 ? `+${pitchDeg}°` : `${pitchDeg}°`}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-slate-400 flex items-center space-x-0.5">
                  <Gauge className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Độ Bám</span>
                </span>
                <span
                  className={`font-bold ${
                    surfaceGrip < 85 ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  {surfaceGrip}%
                </span>
              </div>
            </div>

            {/* 5D Weather Effects */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Thời Tiết & Vật Lý Mặt Sàn
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => onSelectWeather('clear')}
                  className={`flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg border text-[11px] font-semibold transition ${
                    weather === 'clear'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <SunMedium className="w-3.5 h-3.5" />
                  <span>Quang</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('rain')}
                  className={`flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg border text-[11px] font-semibold transition ${
                    weather === 'rain'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>Mưa 5D</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectWeather('wind_dust')}
                  className={`flex items-center justify-center space-x-1 py-1.5 px-1 rounded-lg border text-[11px] font-semibold transition ${
                    weather === 'wind_dust'
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wind className="w-3.5 h-3.5" />
                  <span>Gió Bụi</span>
                </button>
              </div>
            </div>

            {/* 4D Time Dilation */}
            <div className="flex items-center justify-between space-x-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center space-x-1">
                <Clock className="w-3 h-3 text-purple-400" />
                <span>Dòng Thời Gian 4D</span>
              </span>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 font-mono text-[10px]">
                {([0.5, 1, 2] as TimeScaleOption[]).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => onSelectTimeScale(scale)}
                    className={`px-2 py-0.5 rounded-md transition font-bold ${
                      timeScale === scale
                        ? 'bg-purple-500 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {scale}x
                  </button>
                ))}
              </div>
            </div>

            {/* 5D Sensory & Dynamic World Toggles */}
            <div className="grid grid-cols-1 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={onToggleDynamicTraffic}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition ${
                  dynamicTraffic
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>Robot AGV & Drone 4D</span>
                </span>
                <span className="font-mono text-[10px] font-bold">
                  {dynamicTraffic ? 'BẬT' : 'TẮT'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={onToggleHapticFeedback}
                  className={`flex items-center justify-center space-x-1 py-1.5 px-2 rounded-xl border text-[11px] font-semibold transition ${
                    hapticFeedback
                      ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  <span>Rung 5D</span>
                </button>

                <button
                  type="button"
                  onClick={onToggleThermalHud}
                  className={`flex items-center justify-center space-x-1 py-1.5 px-2 rounded-xl border text-[11px] font-semibold transition ${
                    thermalHud
                      ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ScanEye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Thị Giác AI</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

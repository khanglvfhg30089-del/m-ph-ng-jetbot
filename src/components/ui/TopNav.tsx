/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bot, Wifi, Battery, Volume2, VolumeX, BookOpen, RotateCcw, Layers } from 'lucide-react';
import { TelemetryData } from '../../types/jetbot';

interface TopNavProps {
  telemetry: TelemetryData;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenDocs: () => void;
  onResetPos: () => void;
  onOpenAnatomy?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  telemetry,
  isMuted,
  onToggleMute,
  onOpenDocs,
  onResetPos,
  onOpenAnatomy,
}) => {
  return (
    <header className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 flex flex-wrap justify-between items-center z-20 shrink-0">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-bold text-xl shadow-lg shadow-emerald-500/20">
          <Bot className="w-6 h-6 text-slate-950 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-extrabold text-base md:text-lg tracking-wide bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              JETBOT 3D SIMULATOR
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              CMU 10A
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Mô Phỏng Robot Tự Hành AI NVIDIA Jetson Nano &amp; RPLIDAR A1
          </p>
        </div>
      </div>

      {/* Telemetry Chips & Global Actions */}
      <div className="flex items-center space-x-2 md:space-x-3 text-xs mt-2 sm:mt-0">
        {/* Wi-Fi Status */}
        <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300 font-mono text-[11px] hidden sm:inline">JetBot_5G</span>
          <span className="text-emerald-400 font-mono text-[11px] font-bold">98%</span>
        </div>

        {/* Battery Status */}
        <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <Battery className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300 font-mono text-[11px]">
            {telemetry.batteryVoltage}V
          </span>
          <span className="text-slate-400 font-mono text-[11px] font-medium hidden sm:inline">
            ({telemetry.batteryPercent}%)
          </span>
        </div>

        {/* Motor RPM readout */}
        <div className="hidden lg:flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-[11px]">
          <span className="text-slate-500">L:</span>
          <span className="text-emerald-400 font-bold">{telemetry.leftMotorSpeed} RPM</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-500">R:</span>
          <span className="text-emerald-400 font-bold">{telemetry.rightMotorSpeed} RPM</span>
        </div>

        {/* Reset Position */}
        <button
          onClick={onResetPos}
          title="Đưa robot về vạch xuất phát"
          className="p-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Audio Mute Toggle */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Bật âm thanh động cơ & radar' : 'Tắt âm thanh'}
          className={`p-1.5 rounded-lg border transition ${
            isMuted
              ? 'bg-slate-800 text-slate-500 border-slate-700'
              : 'bg-emerald-950/80 text-emerald-400 border-emerald-800 shadow-sm'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Component Inspector Shortcut */}
        {onOpenAnatomy && (
          <button
            onClick={onOpenAnatomy}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold rounded-lg text-xs transition shadow-md shadow-emerald-500/20 active:scale-95"
            title="Xem bóc tách 3D, chức năng, sơ đồ chân và hình ảnh thật của từng bộ phận"
          >
            <Layers className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
            <span className="hidden sm:inline">Chi Tiết Bộ Phận</span>
            <span className="sm:hidden">Bộ Phận</span>
          </button>
        )}

        {/* CMU Guidelines Modal Trigger */}
        <button
          onClick={onOpenDocs}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-lg text-xs border border-slate-700 transition"
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Tài Liệu CMU</span>
        </button>
      </div>
    </header>
  );
};

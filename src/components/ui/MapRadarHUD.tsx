/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Compass,
  MapPin,
  Lightbulb,
  Radar,
  Sun,
  Moon,
  FlaskConical,
  Maximize2,
  Minimize2,
  Navigation,
  Layers,
  Flag,
  Package,
  Building2,
  Route,
} from 'lucide-react';
import { EnvironmentTheme, LidarScanPoint, MapZoneId, TelemetryData } from '../../types/jetbot';
import { ARENA_HALF_SIZE, MAP_ZONES } from '../3d/ArenaEnvironment';

interface MapRadarHUDProps {
  telemetry: TelemetryData;
  lidarPoints: LidarScanPoint[];
  currentTheme: EnvironmentTheme;
  headlightsOn: boolean;
  laserBeamOn: boolean;
  onSelectZone: (zoneId: MapZoneId) => void;
  onSelectTheme: (theme: EnvironmentTheme) => void;
  onToggleHeadlights: () => void;
  onToggleLaserBeam: () => void;
}

export const MapRadarHUD: React.FC<MapRadarHUDProps> = ({
  telemetry,
  lidarPoints,
  currentTheme,
  headlightsOn,
  laserBeamOn,
  onSelectZone,
  onSelectTheme,
  onToggleHeadlights,
  onToggleLaserBeam,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeZoneId, setActiveZoneId] = useState<MapZoneId>('dock');

  // Convert real-world arena meters (-29m to +29m) into SVG 0-100% coordinates
  const arenaSpan = ARENA_HALF_SIZE * 2; // 58 - 60m
  const normX = ((telemetry.posX + ARENA_HALF_SIZE) / arenaSpan) * 100;
  const normY = ((telemetry.posZ + ARENA_HALF_SIZE) / arenaSpan) * 100;

  const handleZoneClick = (id: MapZoneId) => {
    setActiveZoneId(id);
    onSelectZone(id);
  };

  return (
    <div className="absolute top-14 right-3 z-30 pointer-events-auto flex flex-col items-end select-none">
      {/* Top Toggle Bar */}
      <div className="flex items-center space-x-1.5 mb-1.5">
        <button
          onClick={onToggleHeadlights}
          title={headlightsOn ? 'Tắt Đèn Pha LED' : 'Bật Đèn Pha LED'}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg ${
            headlightsOn
              ? 'bg-amber-950/90 text-amber-300 border-amber-500/60 shadow-amber-950/40'
              : 'bg-slate-900/95 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Lightbulb className={`w-3.5 h-3.5 ${headlightsOn ? 'text-amber-400' : ''}`} />
          <span className="hidden sm:inline">Đèn Pha</span>
        </button>

        <button
          onClick={onToggleLaserBeam}
          title={laserBeamOn ? 'Ẩn Chùm Tia Laser' : 'Hiện Chùm Tia Laser'}
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg ${
            laserBeamOn
              ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/60 shadow-cyan-950/40'
              : 'bg-slate-900/95 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Compass className={`w-3.5 h-3.5 ${laserBeamOn ? 'text-cyan-400' : ''}`} />
          <span className="hidden sm:inline">Tia Laser</span>
        </button>

        {/* Lighting Atmosphere Mode Switcher */}
        <div className="flex items-center bg-slate-900/95 border border-slate-800 rounded-xl p-0.5 shadow-lg">
          <button
            onClick={() => onSelectTheme('cyber_lab')}
            title="Ánh Sáng Phòng Lab Công Nghệ"
            className={`p-1.5 rounded-lg transition ${
              currentTheme === 'cyber_lab'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSelectTheme('daylight_city')}
            title="Ánh Sáng Ban Ngày (Daylight)"
            className={`p-1.5 rounded-lg transition ${
              currentTheme === 'daylight_city'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSelectTheme('night_drive')}
            title="Chế Độ Ban Đêm Đèn Đường (Night Drive)"
            className={`p-1.5 rounded-lg transition ${
              currentTheme === 'night_drive'
                ? 'bg-indigo-500 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? 'Thu gọn bản đồ' : 'Mở rộng bản đồ sa hình'}
          className="p-1.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-lg transition"
        >
          {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Radar Minimap Widget */}
      {isExpanded && (
        <div className="w-64 sm:w-72 bg-slate-900/95 border border-slate-800/90 rounded-2xl p-3 shadow-2xl flex flex-col space-y-2.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <h3 className="text-xs font-extrabold text-slate-100 uppercase tracking-wider">
                Sa Hình 60m x 60m
              </h3>
            </div>
            <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              X:{telemetry.posX > 0 ? `+${telemetry.posX}` : telemetry.posX} Z:
              {telemetry.posZ > 0 ? `+${telemetry.posZ}` : telemetry.posZ}m
            </span>
          </div>

          {/* Graphical Scaled 2D Radar Canvas */}
          <div className="relative w-full aspect-square bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner">
            {/* SVG Visual Layout for 4 Zones & Roads */}
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Background Quadrants */}
              {/* Zone D Labyrinth (Top-Left: X < 0, Z < 0) */}
              <rect x="2" y="2" width="46" height="46" fill="#8b5cf6" fillOpacity="0.08" />
              {/* Zone C Race Track (Top-Right: X > 0, Z < 0) */}
              <rect x="52" y="2" width="46" height="46" fill="#ec4899" fillOpacity="0.08" />
              {/* Zone B Warehouse (Bottom-Left: X < 0, Z > 0) */}
              <rect x="2" y="52" width="46" height="46" fill="#f59e0b" fillOpacity="0.08" />
              {/* Zone A Smart City (Bottom-Right: X > 0, Z > 0) */}
              <rect x="52" y="52" width="46" height="46" fill="#38bdf8" fillOpacity="0.08" />

              {/* Main Connecting Roads (East-West & North-South) */}
              <rect x="0" y="44" width="100" height="12" fill="#1e293b" fillOpacity="0.8" />
              <rect x="44" y="0" width="12" height="100" fill="#1e293b" fillOpacity="0.8" />

              {/* Yellow centerlines */}
              <line
                x1="0"
                y1="50"
                x2="100"
                y2="50"
                stroke="#facc15"
                strokeWidth="0.8"
                strokeDasharray="2,2"
              />
              <line
                x1="50"
                y1="0"
                x2="50"
                y2="100"
                stroke="#facc15"
                strokeWidth="0.8"
                strokeDasharray="2,2"
              />

              {/* Central Roundabout */}
              <circle cx="50" cy="50" r="10" fill="#1e293b" stroke="#10b981" strokeWidth="1.2" />
              <circle cx="50" cy="50" r="5" fill="#047857" />

              {/* Race Track Oval in Top-Right */}
              <ellipse
                cx="75"
                cy="25"
                rx="16"
                ry="11"
                fill="none"
                stroke="#ec4899"
                strokeWidth="1.5"
                strokeOpacity="0.6"
              />

              {/* Zone Labels */}
              <text x="25" y="16" fill="#8b5cf6" fontSize="4.5" fontWeight="bold" textAnchor="middle">
                MÊ CUNG
              </text>
              <text x="75" y="16" fill="#ec4899" fontSize="4.5" fontWeight="bold" textAnchor="middle">
                ĐƯỜNG ĐUA
              </text>
              <text x="25" y="86" fill="#f59e0b" fontSize="4.5" fontWeight="bold" textAnchor="middle">
                KHO HÀNG
              </text>
              <text x="75" y="86" fill="#38bdf8" fontSize="4.5" fontWeight="bold" textAnchor="middle">
                ĐÔ THỊ
              </text>

              {/* Real-Time LiDAR Points Scatter */}
              {lidarPoints.map((p, idx) => {
                if (idx % 2 !== 0) return null; // plot every 10 deg for fast SVG
                const rad = ((telemetry.headingDeg + p.angleDeg) * Math.PI) / 180;
                // clamp distance to max 14m
                const d = Math.min(p.distance, 14.0);
                const px = normX + (Math.sin(rad) * d * 100) / arenaSpan;
                const py = normY + (Math.cos(rad) * d * 100) / arenaSpan;
                const color = p.distance < 1.2 ? '#ef4444' : p.distance < 3.0 ? '#facc15' : '#06b6d4';
                return (
                  <circle
                    key={idx}
                    cx={px}
                    cy={py}
                    r="0.9"
                    fill={color}
                    fillOpacity="0.8"
                  />
                );
              })}

              {/* Robot Position & Directional Arrow Marker */}
              <g transform={`translate(${normX}, ${normY}) rotate(${telemetry.headingDeg})`}>
                {/* Heading radar beam cone */}
                <path
                  d="M 0 0 L -8 18 A 20 20 0 0 0 8 18 Z"
                  fill="#10b981"
                  fillOpacity="0.35"
                />
                {/* Robot body circle */}
                <circle cx="0" cy="0" r="3.0" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
                {/* Forward directional pin */}
                <line x1="0" y1="0" x2="0" y2="4.5" stroke="#ffffff" strokeWidth="1.2" />
              </g>
            </svg>

            {/* Radar Sweep Animation Ring */}
            <div className="absolute inset-0 pointer-events-none border border-emerald-500/20 rounded-xl" />
          </div>

          {/* Quick Zone Warp / Teleport Buttons */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              Dịch Chuyển Nhanh Đến Phân Khu:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleZoneClick('city')}
                className="flex items-center space-x-1.5 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition"
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-200 truncate">1. Đô Thị</span>
              </button>

              <button
                onClick={() => handleZoneClick('warehouse')}
                className="flex items-center space-x-1.5 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition"
              >
                <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-200 truncate">2. Kho Hàng</span>
              </button>

              <button
                onClick={() => handleZoneClick('track')}
                className="flex items-center space-x-1.5 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition"
              >
                <Route className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-200 truncate">3. Đường Đua</span>
              </button>

              <button
                onClick={() => handleZoneClick('maze')}
                className="flex items-center space-x-1.5 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-left transition"
              >
                <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-200 truncate">4. Mê Cung</span>
              </button>
            </div>

            <button
              onClick={() => handleZoneClick('dock')}
              className="w-full flex items-center justify-center space-x-1.5 py-1 px-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 text-emerald-300 text-[11px] font-bold transition"
            >
              <Flag className="w-3 h-3 text-emerald-400" />
              <span>Về Vòng Xuyến Trung Tâm (Dock)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

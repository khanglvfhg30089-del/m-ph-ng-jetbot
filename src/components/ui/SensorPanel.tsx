/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { Eye, SatelliteDish, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { LidarScanPoint, TelemetryData } from '../../types/jetbot';

interface SensorPanelProps {
  telemetry: TelemetryData;
  lidarPoints: LidarScanPoint[];
  closestDist: number;
}

export const SensorPanel: React.FC<SensorPanelProps> = ({
  telemetry,
  lidarPoints,
  closestDist,
}) => {
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sweepAngleRef = useRef(0);

  // 1. Draw 2D RPLIDAR 360° Radar
  useEffect(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const renderRadar = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const maxRadius = cx - 12;

      // Radar dark background
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
      ctx.fill();

      // Concentric Distance Rings (0.5m, 1.5m, 3.0m, 6.0m scale)
      const ringDistances = [0.25, 0.5, 0.75, 1.0];
      ringDistances.forEach((frac, idx) => {
        const r = maxRadius * frac;
        ctx.strokeStyle = idx === 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(6, 182, 212, 0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Distance label
        ctx.setLineDash([]);
        ctx.fillStyle = '#64748b';
        ctx.font = '8px monospace';
        ctx.fillText(`${(frac * 6).toFixed(1)}m`, cx + 4, cy - r + 8);
      });

      // Crosshairs
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      ctx.stroke();

      // Rotating Radar Sweeper Line & Phosphor Glow Wedge
      sweepAngleRef.current += 0.06;
      const sweepAngle = sweepAngleRef.current;

      const gradient = ctx.createRadialGradient(cx, cy, 5, cx, cy, maxRadius);
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, sweepAngle - 0.4, sweepAngle);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius, cy + Math.sin(sweepAngle) * maxRadius);
      ctx.stroke();

      // Plot Actual Laser Scan Points from 3D Environment
      const scaleMetersToPx = maxRadius / 6.0; // 6m max display radius
      for (const pt of lidarPoints) {
        // JetBot forward is straight up in the radar display (-90 deg from standard cartesian)
        const rad = ((pt.angleDeg - 90) * Math.PI) / 180;
        const d = Math.min(pt.distance, 6.0);
        const px = cx + Math.cos(rad) * (d * scaleMetersToPx);
        const py = cy + Math.sin(rad) * (d * scaleMetersToPx);

        if (pt.distance < 0.6) {
          ctx.fillStyle = '#ef4444'; // Danger
        } else if (pt.distance < 1.2) {
          ctx.fillStyle = '#f59e0b'; // Warning
        } else {
          ctx.fillStyle = '#22d3ee'; // Safe return
        }

        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Follow-The-Gap chosen heading vector in obstacle avoidance mode
      if (telemetry.currentMode === 'obstacle_avoidance' && telemetry.targetGapDeg !== undefined) {
        const gapRad = ((-telemetry.targetGapDeg - 90) * Math.PI) / 180;
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(gapRad) * (maxRadius * 0.85), cy + Math.sin(gapRad) * (maxRadius * 0.85));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Center JetBot Icon
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Forward direction arrow
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx - 3, cy - 2);
      ctx.lineTo(cx + 3, cy - 2);
      ctx.closePath();
      ctx.fill();

      animId = requestAnimationFrame(renderRadar);
    };

    renderRadar();
    return () => cancelAnimationFrame(animId);
  }, [lidarPoints, telemetry.currentMode, telemetry.targetGapDeg]);

  // 2. Draw Live Camera Stream Perception
  useEffect(() => {
    const canvas = cameraCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let t = 0;

    const renderCamera = () => {
      t += 0.03;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Floor perception perspective lines
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ground horizon line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height * 0.42);
      ctx.lineTo(canvas.width, canvas.height * 0.42);
      ctx.stroke();

      // Perspective track guides driven by live telemetry
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1.5;
      const horizonY = canvas.height * 0.42;
      const errShift = (telemetry.lineError ?? 0) * 62;
      const vpX = canvas.width / 2 + errShift * 0.45;

      for (let i = -80; i <= canvas.width + 80; i += 32) {
        ctx.beginPath();
        ctx.moveTo(vpX, horizonY);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }

      // Optical Line Follower Centerline curve reflecting actual lineError
      ctx.strokeStyle = telemetry.lineDetected ? '#22d3ee' : '#10b981';
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 + errShift, horizonY + 12);
      ctx.quadraticCurveTo(
        canvas.width / 2 + errShift * 0.55,
        canvas.height * 0.72,
        canvas.width * 0.5 + errShift * 0.25,
        canvas.height
      );
      ctx.stroke();
      ctx.setLineDash([]);

      // Target marker dot on tracked line
      ctx.fillStyle = telemetry.autoStatus === 'LINE_OBSTACLE_AVOID' ? '#ef4444' : '#22d3ee';
      ctx.beginPath();
      ctx.arc(canvas.width / 2 + errShift * 0.65, canvas.height * 0.68, 5, 0, Math.PI * 2);
      ctx.fill();

      // Compute forward-FOV (±35°) obstacle distance so side walls/racks do not trigger front camera box
      let frontDist = Infinity;
      let frontBiasDeg = 0;
      for (const pt of lidarPoints) {
        if (Math.abs(pt.angleDeg) <= 35 && pt.distance < frontDist) {
          frontDist = pt.distance;
          frontBiasDeg = pt.angleDeg;
        }
      }

      // Dynamic AI Detection Bounding Box when a forward obstacle is within camera FOV (< 3.2m)
      if (frontDist < 3.2) {
        const boxW = Math.max(56, Math.min(125, Math.round(160 / Math.max(0.9, frontDist))));
        const boxH = Math.round(boxW * 0.78);
        // Positive angleDeg = LEFT -> negative X shift on camera canvas
        const boxX = canvas.width / 2 - boxW / 2 - (frontBiasDeg / 35) * 75;
        const boxY = canvas.height * 0.44;

        ctx.strokeStyle = frontDist < 1.1 ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = frontDist < 1.1 ? 'rgba(239, 68, 68, 0.88)' : 'rgba(245, 158, 11, 0.88)';
        ctx.fillRect(boxX, boxY - 14, boxW, 14);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`VẬT CẢN ${frontDist.toFixed(1)}m`, boxX + 4, boxY - 3);
      }

      // HUD Optical Crosshair
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
      ctx.lineWidth = 1;
      const chX = canvas.width / 2;
      const chY = canvas.height / 2;
      ctx.beginPath();
      ctx.moveTo(chX - 10, chY);
      ctx.lineTo(chX + 10, chY);
      ctx.moveTo(chX, chY - 10);
      ctx.lineTo(chX, chY + 10);
      ctx.stroke();

      animId = requestAnimationFrame(renderCamera);
    };

    renderCamera();
    return () => cancelAnimationFrame(animId);
  }, [lidarPoints, telemetry.lineError, telemetry.lineDetected, telemetry.autoStatus]);

  const liveConfidence =
    telemetry.currentMode === 'line_follower'
      ? `${telemetry.lineConfidence ?? 0}%`
      : closestDist < 3.2
      ? '97.2%'
      : '94.8%';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 max-w-5xl mx-auto w-full">
      {/* 1. LIVE CSI CAMERA AI VISION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">
              Live Camera CSI (AI Vision Jetson)
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/90 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center space-x-1">
            <Zap className="w-3 h-3 text-emerald-400 fill-current" />
            <span>YOLOv8 &bull; Pure Pursuit</span>
          </span>
        </div>

        {/* Video Canvas Container */}
        <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <canvas ref={cameraCanvasRef} width={360} height={202} className="w-full h-full object-cover" />
          <div className="absolute top-2 left-2 flex items-center space-x-2 text-[9px] font-mono text-emerald-400 bg-slate-950/90 px-2 py-1 rounded border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span>REC 1080p @ 30FPS</span>
          </div>
          <div className="absolute bottom-2 right-2 text-[9px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
            MODE: {telemetry.autoStatus ?? 'MANUAL'} &bull; SONY IMX219
          </div>
        </div>

        {/* Vision Pipeline Status */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-slate-500 block">Mô hình AI:</span>
            <span className="text-slate-200 font-bold">
              {telemetry.currentMode === 'line_follower' ? 'Pure Pursuit PD' : 'TensorRT FTG'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Độ tin cậy:</span>
            <span className="text-emerald-400 font-bold font-mono">{liveConfidence}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Lệch làn / Vật cản:</span>
            <span className="text-cyan-400 font-bold font-mono">
              {telemetry.currentMode === 'line_follower'
                ? `${(telemetry.lineError ?? 0).toFixed(2)}`
                : `${closestDist.toFixed(1)}m`}
            </span>
          </div>
        </div>
      </div>

      {/* 2. RPLIDAR 360° LASER SCANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <SatelliteDish className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">
              Cảm Biến Laser RPLIDAR 360° Radar
            </span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center space-x-1 ${
              closestDist < 0.6
                ? 'bg-red-950 text-red-400 border border-red-800 font-bold'
                : closestDist < 1.2
                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
            }`}
          >
            {closestDist < 0.6 ? (
              <>
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span>NGUY HIỂM &bull; &lt;0.6m</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>AN TOÀN &bull; {closestDist.toFixed(1)}m</span>
              </>
            )}
          </span>
        </div>

        {/* Radar Canvas View */}
        <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center p-2">
          <canvas ref={radarCanvasRef} width={220} height={220} className="w-48 h-48 rounded-full" />
        </div>

        {/* LiDAR Specs & Distance Readout */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-slate-500 block">Tần số quét:</span>
            <span className="text-cyan-400 font-bold font-mono">10 Hz (600 RPM)</span>
          </div>
          <div>
            <span className="text-slate-500 block">Gần nhất:</span>
            <span
              className={`font-bold font-mono ${
                closestDist < 0.6 ? 'text-red-400 font-extrabold' : 'text-emerald-400'
              }`}
            >
              {closestDist.toFixed(2)} m
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Thuật toán SLAM:</span>
            <span className="text-slate-200 font-bold">Cartographer</span>
          </div>
        </div>
      </div>
    </div>
  );
};

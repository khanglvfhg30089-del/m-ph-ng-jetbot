/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { JetBotSceneManager } from './components/3d/SceneManager';
import { TopNav } from './components/ui/TopNav';
import { ModeTabs, ActiveTab } from './components/ui/ModeTabs';
import { ControlDock } from './components/ui/ControlDock';
import { SensorPanel } from './components/ui/SensorPanel';
import { ComponentInspector } from './components/ui/ComponentInspector';
import { ComponentHotspots3D } from './components/ui/ComponentHotspots3D';
import { DocsModal } from './components/ui/DocsModal';
import { CameraOverlayHUD } from './components/ui/CameraOverlayHUD';
import { Model3DStudio } from './components/ui/Model3DStudio';
import { MapRadarHUD } from './components/ui/MapRadarHUD';
import { soundEngine } from './utils/audio';
import {
  CameraViewMode,
  ComponentHotspot,
  ComponentViewMode,
  DriveDirection,
  DriveInputs,
  EnvironmentTheme,
  LidarScanPoint,
  LineTrackId,
  MapZoneId,
  ModelVariant,
  RenderShaderStyle,
  TelemetryData,
} from './types/jetbot';


const initialTelemetry: TelemetryData = {
  leftMotorSpeed: 0,
  rightMotorSpeed: 0,
  linearVelocity: 0,
  angularVelocity: 0,
  batteryVoltage: 12.4,
  batteryPercent: 88,
  wifiSignalDbm: -42,
  cpuTemp: 46,
  gpuUsage: 12,
  closestObstacleDist: 3.8,
  headingDeg: 0,
  currentMode: 'manual',
  posX: 0,
  posZ: 0,
  autoStatus: 'MANUAL',
  targetGapDeg: 0,
  lineError: 0,
  lineDetected: false,
  lineConfidence: 0,
  activeTrackId: 'roundabout',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const managerRef = useRef<JetBotSceneManager | null>(null);

  // Application State
  const [activeTab, setActiveTab] = useState<ActiveTab>('sim');
  const activeTabRef = useRef<ActiveTab>(activeTab);
  activeTabRef.current = activeTab;
  const [telemetry, setTelemetry] = useState<TelemetryData>(initialTelemetry);
  const [lidarPoints, setLidarPoints] = useState<LidarScanPoint[]>([]);
  const [closestDist, setClosestDist] = useState<number>(3.8);

  // Controls State
  const [speedPercent, setSpeedPercent] = useState<number>(60);
  const [isAutopilot, setIsAutopilot] = useState<boolean>(false);
  const [isLineFollower, setIsLineFollower] = useState<boolean>(false);
  const [lineTrack, setLineTrack] = useState<LineTrackId>('auto');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('orbit');
  const [explodeProgress, setExplodeProgress] = useState<number>(0);
  const [selectedCompId, setSelectedCompId] = useState<string>('wheels');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDocsOpen, setIsDocsOpen] = useState<boolean>(false);
  const [hotspots, setHotspots] = useState<ComponentHotspot[]>([]);
  const [areHotspotsVisible, setAreHotspotsVisible] = useState<boolean>(true);
  const [hoveredComponent, setHoveredComponent] = useState<{ id: string; nameVi: string; clientX: number; clientY: number } | null>(null);

  // Proving Ground & Realism Controls State
  const [headlightsOn, setHeadlightsOn] = useState<boolean>(true);
  const [laserBeamOn, setLaserBeamOn] = useState<boolean>(true);
  const [currentTheme, setCurrentTheme] = useState<EnvironmentTheme>('cyber_lab');

  // Persistent 3D Model Studio State (preserved across tab switches)
  const [studioStyle, setStudioStyle] = useState<RenderShaderStyle>('pbr');
  const [studioColorHex, setStudioColorHex] = useState<number>(0x15803d);
  const [studioVariant, setStudioVariant] = useState<ModelVariant>('rplidar');
  const [studioShowDimensions, setStudioShowDimensions] = useState<boolean>(false);
  const [studioAutoRotate, setStudioAutoRotate] = useState<boolean>(false);
  const [studioRotateSpeed, setStudioRotateSpeed] = useState<number>(1.0);
  const [studioSelectedPartId, setStudioSelectedPartId] = useState<string | null>(null);
  const [studioPartVisibilities, setStudioPartVisibilities] = useState<Record<string, boolean>>({
    wheels: true,
    motorBoard: true,
    jetsonNano: true,
    ports: true,
    lidar: true,
    camera: true,
    antennas: true,
    stereo: false,
  });

  // Initialize Three.js SceneManager once
  useEffect(() => {
    if (!mountRef.current) return;

    const manager = new JetBotSceneManager(mountRef.current, {
      onTelemetryUpdate: (data) => {
        setTelemetry(data);
      },
      onLidarScan: (points, minDist) => {
        setLidarPoints(points);
        setClosestDist(minDist);
      },
      onComponentSelect: (compId) => {
        if (!compId) return;
        if (activeTabRef.current === 'model3d') {
          setStudioSelectedPartId(compId);
          managerRef.current?.setHighlightedPart(compId);
        } else {
          setSelectedCompId(compId);
          setActiveTab('anatomy');
          managerRef.current?.setHotspotsEnabled(true);
          managerRef.current?.setInspectionOrbitRange(true);
          managerRef.current?.setHighlightedPart(compId);
        }
      },
      onComponentHover: (info) => {
        setHoveredComponent(info);
      },
      onHotspotsUpdate: (pts) => {
        setHotspots(pts);
      },
    });

    managerRef.current = manager;

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  // Handlers for ControlDock
  const handleDriveStart = useCallback((dir: DriveDirection) => {
    managerRef.current?.setDriveDirection(dir);
  }, []);

  const handleDriveStop = useCallback(() => {
    managerRef.current?.setDriveDirection('stop');
  }, []);

  const handleDriveInputs = useCallback((inputs: Partial<DriveInputs>) => {
    managerRef.current?.setDriveInputs(inputs);
  }, []);

  const handleSpeedChange = useCallback((val: number) => {
    setSpeedPercent(val);
    managerRef.current?.setSpeedPercent(val);
  }, []);

  const handleToggleAutopilot = useCallback(() => {
    setIsAutopilot((prev) => {
      const next = !prev;
      if (next) setIsLineFollower(false);
      managerRef.current?.setAutopilot(next);
      return next;
    });
  }, []);

  const handleToggleLineFollower = useCallback(() => {
    setIsLineFollower((prev) => {
      const next = !prev;
      if (next) setIsAutopilot(false);
      managerRef.current?.setLineFollower(next);
      return next;
    });
  }, []);

  const handleSelectLineTrack = useCallback((trackId: LineTrackId, warpToTrack = true) => {
    setLineTrack(trackId);
    managerRef.current?.setLineTrack(trackId, warpToTrack && trackId !== 'auto');
    if (trackId !== 'auto') {
      setIsAutopilot(false);
      setIsLineFollower(true);
      managerRef.current?.setLineFollower(true);
    }
  }, []);

  const handleCameraChange = useCallback((mode: CameraViewMode) => {
    setCameraMode(mode);
    managerRef.current?.setCameraView(mode);
  }, []);

  const handleExplodeChange = useCallback((val: number) => {
    setExplodeProgress(val);
    managerRef.current?.setExplodedView(val);
  }, []);

  const handleResetPos = useCallback(() => {
    managerRef.current?.resetRobotPosition();
    managerRef.current?.setAutopilot(false);
    managerRef.current?.setLineFollower(false);
    setIsAutopilot(false);
    setIsLineFollower(false);
    setLineTrack('auto');
    setCameraMode('orbit');
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  // 3D Model Studio Handlers
  const handleSetRenderStyle = useCallback((style: RenderShaderStyle) => {
    setStudioStyle(style);
    managerRef.current?.setRenderStyle(style);
  }, []);

  const handleSetChassisColor = useCallback((hex: number) => {
    setStudioColorHex(hex);
    managerRef.current?.setChassisColor(hex);
  }, []);

  const handleSetPartVisibility = useCallback((partId: string, visible: boolean) => {
    setStudioPartVisibilities((prev) => ({ ...prev, [partId]: visible }));
    managerRef.current?.setPartVisibility(partId, visible);
  }, []);

  const handleSetAllPartsVisibility = useCallback((visible: boolean) => {
    setStudioPartVisibilities((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        next[k] = visible;
        managerRef.current?.setPartVisibility(k, visible);
      });
      return next;
    });
  }, []);

  const handleSetDimensionsVisible = useCallback((visible: boolean) => {
    setStudioShowDimensions(visible);
    managerRef.current?.setDimensionsVisible(visible);
  }, []);

  const handleSetModelVariant = useCallback((variant: ModelVariant) => {
    setStudioVariant(variant);
    setStudioPartVisibilities((prev) => ({
      ...prev,
      lidar: variant === 'rplidar',
      camera: variant !== 'stereo',
      stereo: variant === 'stereo',
    }));
    managerRef.current?.setModelVariant(variant);
  }, []);

  const handleSetAutoRotate = useCallback((enabled: boolean, speed?: number) => {
    setStudioAutoRotate(enabled);
    if (speed !== undefined) setStudioRotateSpeed(speed);
    managerRef.current?.setAutoRotate(enabled, speed);
  }, []);

  const handleSetPresetView = useCallback((view: 'isometric' | 'top' | 'front' | 'side' | 'bottom') => {
    managerRef.current?.setPresetView(view);
  }, []);

  const handleCaptureSnapshot = useCallback(() => {
    const dataUrl = managerRef.current?.captureSnapshot();
    if (dataUrl) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `jetbot_3d_snapshot_${Date.now()}.png`;
      a.click();
    }
  }, []);

  const handleFocusPartIn3D = useCallback((partId: string, mode: ComponentViewMode, zoomToPart = false) => {
    setSelectedCompId(partId);
    if (mode === 'solo') {
      managerRef.current?.focusOnComponent(partId, 'solo');
    } else if (mode === 'ghost') {
      managerRef.current?.focusOnComponent(partId, 'ghost');
    } else if (zoomToPart) {
      managerRef.current?.focusOnComponent(partId, 'none');
    } else {
      managerRef.current?.focusOnComponent(null, 'none');
      managerRef.current?.setHighlightedPart(partId);
    }
  }, []);

  const handleSelectStudioPart = useCallback((partId: string | null) => {
    setStudioSelectedPartId(partId);
    managerRef.current?.setHighlightedPart(partId);
  }, []);

  const handleFocusStudioPart = useCallback((partId: string) => {
    setStudioSelectedPartId(partId);
    managerRef.current?.focusOnComponent(partId, 'none');
    managerRef.current?.setHighlightedPart(partId);
  }, []);

  const handleResetFullView = useCallback(() => {
    managerRef.current?.focusOnComponent(null, 'none');
  }, []);

  const handleSelectZone = useCallback((zoneId: MapZoneId) => {
    managerRef.current?.teleportToZone(zoneId);
  }, []);

  const handleSelectTheme = useCallback((theme: EnvironmentTheme) => {
    setCurrentTheme(theme);
    managerRef.current?.setEnvironmentTheme(theme);
  }, []);

  const handleToggleHeadlights = useCallback(() => {
    const next = managerRef.current?.toggleHeadlights();
    if (next !== undefined) setHeadlightsOn(next);
  }, []);

  const handleToggleLaserBeam = useCallback(() => {
    const next = managerRef.current?.toggleLaserBeam();
    if (next !== undefined) setLaserBeamOn(next);
  }, []);

  const handleTabSelect = (tab: ActiveTab) => {
    setActiveTab(tab);
    managerRef.current?.setHotspotsEnabled(tab === 'anatomy');
    managerRef.current?.setInspectionOrbitRange(tab === 'model3d' || tab === 'anatomy');
    managerRef.current?.setDimensionsVisible(tab === 'model3d' ? studioShowDimensions : false);

    if (tab === 'cmu') {
      setIsDocsOpen(true);
    } else if (tab === 'anatomy') {
      handleDriveStop();
      setIsAutopilot(false);
      setIsLineFollower(false);
      setStudioAutoRotate(false);
      managerRef.current?.resetTurntableHeading();
      const nextExp = explodeProgress < 0.2 ? 0.65 : explodeProgress;
      if (explodeProgress < 0.2) {
        handleExplodeChange(nextExp);
      }
      managerRef.current?.focusOnComponent(null, 'none');
      managerRef.current?.setHighlightedPart(selectedCompId);
    } else if (tab === 'model3d') {
      handleDriveStop();
      setIsAutopilot(false);
      setIsLineFollower(false);
      managerRef.current?.focusOnComponent(null, 'none');
      managerRef.current?.setHighlightedPart(studioSelectedPartId);
      managerRef.current?.setPresetView('isometric');
    } else if (tab === 'sim') {
      setStudioAutoRotate(false);
      managerRef.current?.resetTurntableHeading();
      managerRef.current?.setHighlightedPart(null);
      handleExplodeChange(0);
      managerRef.current?.focusOnComponent(null, 'none');
    }
  };

  const handleOpenAnatomy = useCallback((targetPartId?: string) => {
    const coreIds = new Set(['wheels', 'motorBoard', 'jetson', 'ports', 'lidar', 'camera', 'antennas']);
    const resolvedComp = targetPartId && coreIds.has(targetPartId) ? targetPartId : selectedCompId;
    if (targetPartId && coreIds.has(targetPartId)) {
      setSelectedCompId(targetPartId);
    }
    setActiveTab('anatomy');
    handleDriveStop();
    setIsAutopilot(false);
    setIsLineFollower(false);
    setStudioAutoRotate(false);
    managerRef.current?.resetTurntableHeading();
    managerRef.current?.setHotspotsEnabled(true);
    managerRef.current?.setInspectionOrbitRange(true);
    managerRef.current?.setDimensionsVisible(false);
    if (explodeProgress < 0.2) {
      handleExplodeChange(0.65);
    }
    setAreHotspotsVisible(true);
    managerRef.current?.focusOnComponent(null, 'none');
    managerRef.current?.setHighlightedPart(resolvedComp);
  }, [handleDriveStop, explodeProgress, handleExplodeChange, selectedCompId]);

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* 1. TOP HEADER & TELEMETRY */}
      <TopNav
        telemetry={telemetry}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onOpenDocs={() => setIsDocsOpen(true)}
        onResetPos={handleResetPos}
        onOpenAnatomy={() => handleOpenAnatomy()}
      />

      {/* 2. MODE NAVIGATION TABS */}
      <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between shrink-0 z-10">
        <ModeTabs activeTab={activeTab} onSelectTab={handleTabSelect} />

        <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>NVIDIA Jetson Nano Developer Kit &bull; RPLIDAR A1</span>
        </div>
      </div>

      {/* 3. CENTRAL 3D VIEWPORT CONTAINER */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Full-bleed Three.js WebGL Mount Canvas */}
        <div ref={mountRef} className="absolute inset-0 w-full h-full bg-slate-950" />

        {/* Dynamic Multi-Perspective Camera HUD & Floating Switcher (Simulation tab) */}
        {activeTab === 'sim' && (
          <CameraOverlayHUD
            cameraMode={cameraMode}
            onCameraChange={handleCameraChange}
            telemetry={telemetry}
            onResetCamera={handleResetPos}
          />
        )}

        {/* Real-time 60m Proving Ground Map, Teleporter & Lighting HUD */}
        {activeTab === 'sim' && (
          <MapRadarHUD
            telemetry={telemetry}
            lidarPoints={lidarPoints}
            currentTheme={currentTheme}
            headlightsOn={headlightsOn}
            laserBeamOn={laserBeamOn}
            onSelectZone={handleSelectZone}
            onSelectTheme={handleSelectTheme}
            onToggleHeadlights={handleToggleHeadlights}
            onToggleLaserBeam={handleToggleLaserBeam}
          />
        )}

        {/* OVERLAY VIEW 1: SENSORS & AI HUB */}
        {activeTab === 'sensors' && (
          <div className="absolute inset-0 bg-slate-950/85 overflow-y-auto z-20 p-2 sm:p-6 animate-fadeIn">
            <SensorPanel
              telemetry={telemetry}
              lidarPoints={lidarPoints}
              closestDist={closestDist}
            />
          </div>
        )}

        {/* OVERLAY VIEW 2: DEDICATED 3D MODEL STUDIO & CAD INSPECTOR */}
        {activeTab === 'model3d' && (
          <Model3DStudio
            selectedStyle={studioStyle}
            selectedColorHex={studioColorHex}
            selectedVariant={studioVariant}
            showDimensions={studioShowDimensions}
            autoRotate={studioAutoRotate}
            rotateSpeed={studioRotateSpeed}
            partVisibilities={studioPartVisibilities}
            explodeProgress={explodeProgress}
            selectedPartId={studioSelectedPartId}
            onSelectPart={handleSelectStudioPart}
            onFocusPart={handleFocusStudioPart}
            onSetExplode={handleExplodeChange}
            onSetRenderStyle={handleSetRenderStyle}
            onSetChassisColor={handleSetChassisColor}
            onSetPartVisibility={handleSetPartVisibility}
            onSetAllPartsVisibility={handleSetAllPartsVisibility}
            onSetDimensionsVisible={handleSetDimensionsVisible}
            onSetModelVariant={handleSetModelVariant}
            onSetAutoRotate={handleSetAutoRotate}
            onSetPresetView={handleSetPresetView}
            onCaptureSnapshot={handleCaptureSnapshot}
            onOpenAnatomy={handleOpenAnatomy}
            meshStats={managerRef.current?.getMeshStats()}
          />
        )}

        {/* OVERLAY VIEW 3: COMPONENT ANATOMY & EXPLODED INSPECTOR */}
        {activeTab === 'anatomy' && (
          <>
            <ComponentHotspots3D
              hotspots={hotspots}
              selectedId={selectedCompId}
              onSelectComponent={(id) => {
                setSelectedCompId(id);
                managerRef.current?.focusOnComponent(id, 'none');
              }}
              isVisible={areHotspotsVisible}
              onToggleVisible={() => setAreHotspotsVisible(!areHotspotsVisible)}
            />

            <div className="absolute inset-0 z-20 animate-fadeIn pointer-events-none">
              <ComponentInspector
                selectedId={selectedCompId}
                onSelectComponent={(id) => {
                  setSelectedCompId(id);
                }}
                explodeProgress={explodeProgress}
                onSetExplode={handleExplodeChange}
                onFocusPartIn3D={handleFocusPartIn3D}
                onResetFullView={handleResetFullView}
                areHotspotsVisible={areHotspotsVisible}
                onToggleHotspots={() => setAreHotspotsVisible(!areHotspotsVisible)}
              />
            </div>
          </>
        )}

        {/* Floating 3D Hover Tooltip for any interactive component */}
        {hoveredComponent && (
          <div
            style={{
              left: `${hoveredComponent.clientX + 14}px`,
              top: `${hoveredComponent.clientY - 34}px`,
            }}
            className="fixed pointer-events-none z-50 px-2.5 py-1 rounded-lg bg-slate-900/95 border border-emerald-500/80 text-emerald-300 text-xs font-bold shadow-2xl flex items-center space-x-1.5 animate-fadeIn"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{hoveredComponent.nameVi}</span>
            <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
              {activeTab === 'model3d' ? '(Click để xem ảnh & chức năng)' : '(Click để xem chi tiết)'}
            </span>
          </div>
        )}


        {/* 4. UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK (Shown in Simulation tab) */}
        {activeTab === 'sim' && (
          <ControlDock
            telemetry={telemetry}
            speedPercent={speedPercent}
            onSpeedChange={handleSpeedChange}
            onDriveStart={handleDriveStart}
            onDriveStop={handleDriveStop}
            onDriveInputs={handleDriveInputs}
            isAutopilot={isAutopilot}
            onToggleAutopilot={handleToggleAutopilot}
            isLineFollower={isLineFollower}
            onToggleLineFollower={handleToggleLineFollower}
            lineTrack={lineTrack}
            onSelectLineTrack={handleSelectLineTrack}
            cameraMode={cameraMode}
            onCameraChange={handleCameraChange}
            explodeProgress={explodeProgress}
            onExplodeChange={handleExplodeChange}
          />
        )}
      </main>

      {/* 5. CMU GUIDELINES & PROJECT DOCUMENTATION MODAL */}
      <DocsModal isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  Cpu,
  SatelliteDish,
  Camera,
  Radio,
  Sliders,
  Cable,
  CheckCircle2,
  Zap,
  Terminal,
  Wrench,
  Eye,
  Crosshair,
  Sparkles,
  Info,
  Maximize2,
  Minimize2,
  Box,
  Compass,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  X,
  ZoomIn,
} from 'lucide-react';
import { ComponentViewMode, JetBotComponentInfo } from '../../types/jetbot';
import { JETBOT_COMPONENTS } from '../../data/jetbotComponents';

export { JETBOT_COMPONENTS };

interface ComponentInspectorProps {
  selectedId: string | null;
  onSelectComponent: (id: string) => void;
  explodeProgress: number;
  onSetExplode: (val: number) => void;
  onFocusPartIn3D?: (partId: string, mode: ComponentViewMode, zoomToPart?: boolean) => void;
  onResetFullView?: () => void;
  areHotspotsVisible?: boolean;
  onToggleHotspots?: () => void;
}

export const ComponentInspector: React.FC<ComponentInspectorProps> = ({
  selectedId,
  onSelectComponent,
  explodeProgress,
  onSetExplode,
  onFocusPartIn3D,
  onResetFullView,
  areHotspotsVisible = true,
  onToggleHotspots,
}) => {
  const [activeInfoTab, setActiveInfoTab] = useState<
    'functions' | 'photos' | 'interfaces' | 'ros' | 'specs' | 'lab'
  >('functions');
  const [viewMode, setViewMode] = useState<ComponentViewMode>('exploded');
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'mechanical' | 'electronic' | 'sensor' | 'compute'>('all');
  const [isAutoExploding, setIsAutoExploding] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; caption: string; perspective: string } | null>(null);

  const autoExplodeDirectionRef = useRef<number>(1);
  const autoExplodeAnimRef = useRef<number | null>(null);
  const explodeValueRef = useRef<number>(explodeProgress);
  explodeValueRef.current = explodeProgress;

  const currentComp =
    JETBOT_COMPONENTS.find((c) => c.id === selectedId) || JETBOT_COMPONENTS[0];

  const filteredComponents = JETBOT_COMPONENTS.filter((c) => {
    if (categoryFilter === 'all') return true;
    return c.category === categoryFilter;
  });

  const currentIndex = JETBOT_COMPONENTS.findIndex((c) => c.id === currentComp.id);

  // Ref-backed smooth auto-disassembly animation loop (zero per-frame RAF teardown)
  useEffect(() => {
    if (!isAutoExploding) {
      if (autoExplodeAnimRef.current) cancelAnimationFrame(autoExplodeAnimRef.current);
      autoExplodeAnimRef.current = null;
      return;
    }

    let lastT = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;

      let next = explodeValueRef.current + autoExplodeDirectionRef.current * dt * 0.45;
      if (next >= 1.0) {
        next = 1.0;
        autoExplodeDirectionRef.current = -1;
      } else if (next <= 0.0) {
        next = 0.0;
        autoExplodeDirectionRef.current = 1;
      }

      explodeValueRef.current = next;
      onSetExplode(next);
      autoExplodeAnimRef.current = requestAnimationFrame(loop);
    };

    autoExplodeAnimRef.current = requestAnimationFrame(loop);
    return () => {
      if (autoExplodeAnimRef.current) cancelAnimationFrame(autoExplodeAnimRef.current);
      autoExplodeAnimRef.current = null;
    };
  }, [isAutoExploding, onSetExplode]);

  const handleModeChange = (mode: ComponentViewMode) => {
    setViewMode(mode);
    setIsAutoExploding(false);
    if (mode === 'exploded') {
      if (explodeProgress < 0.2) onSetExplode(0.75);
      if (onFocusPartIn3D) onFocusPartIn3D(currentComp.id, 'exploded');
    } else if (mode === 'solo') {
      if (onFocusPartIn3D) onFocusPartIn3D(currentComp.id, 'solo');
    } else if (mode === 'ghost') {
      if (onFocusPartIn3D) onFocusPartIn3D(currentComp.id, 'ghost');
    } else {
      // assembly
      onSetExplode(0);
      if (onFocusPartIn3D) onFocusPartIn3D(currentComp.id, 'assembly');
      if (onResetFullView) onResetFullView();
    }
  };

  const handleSelectComp = (id: string) => {
    onSelectComponent(id);
    if (onFocusPartIn3D) {
      onFocusPartIn3D(id, viewMode);
    }
  };

  const handlePrevComp = () => {
    const prevIdx = (currentIndex - 1 + JETBOT_COMPONENTS.length) % JETBOT_COMPONENTS.length;
    handleSelectComp(JETBOT_COMPONENTS[prevIdx].id);
  };

  const handleNextComp = () => {
    const nextIdx = (currentIndex + 1) % JETBOT_COMPONENTS.length;
    handleSelectComp(JETBOT_COMPONENTS[nextIdx].id);
  };

  const handleMacroZoom = () => {
    if (onFocusPartIn3D) {
      onFocusPartIn3D(currentComp.id, viewMode, true);
    }
  };

  // Keyboard navigation inside Anatomy view: ArrowLeft/Right step parts, 1-4 switch mode, Space toggles auto-explode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIdx = (currentIndex - 1 + JETBOT_COMPONENTS.length) % JETBOT_COMPONENTS.length;
        const prevId = JETBOT_COMPONENTS[prevIdx].id;
        onSelectComponent(prevId);
        if (onFocusPartIn3D) onFocusPartIn3D(prevId, viewMode);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIdx = (currentIndex + 1) % JETBOT_COMPONENTS.length;
        const nextId = JETBOT_COMPONENTS[nextIdx].id;
        onSelectComponent(nextId);
        if (onFocusPartIn3D) onFocusPartIn3D(nextId, viewMode);
      } else if (e.key === '1') {
        setViewMode('assembly');
        setIsAutoExploding(false);
        onSetExplode(0);
        if (onResetFullView) onResetFullView();
      } else if (e.key === '2') {
        setViewMode('exploded');
        setIsAutoExploding(false);
        if (explodeValueRef.current < 0.2) onSetExplode(0.75);
        if (onFocusPartIn3D) onFocusPartIn3D(currentComp.id, 'exploded');
      } else if (e.key === '3') {
        setViewMode('ghost');
        setIsAutoExploding(false);
        if (onFocusPartIn3D) onFocusPartIn3D(currentComp.id, 'ghost');
      } else if (e.key === '4') {
        setViewMode('solo');
        setIsAutoExploding(false);
        if (onFocusPartIn3D) onFocusPartIn3D(currentComp.id, 'solo');
      } else if (e.key === 'Escape' && selectedPhoto) {
        setSelectedPhoto(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, currentComp.id, viewMode, selectedPhoto, onSelectComponent, onFocusPartIn3D, onSetExplode, onResetFullView]);

  return (
    <div className="relative w-full h-full flex flex-col pointer-events-none select-none">
      {/* TOP CONTROL BAR: High-Tech View Mode Selector & Disassembly Controls */}
      <div className="pointer-events-auto mx-auto mt-2 max-w-6xl w-full px-3">
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2.5">
          {/* Mode Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto p-1 bg-slate-950/80 rounded-xl border border-slate-800/80">
            <button
              onClick={() => handleModeChange('assembly')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'assembly'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>1. Lắp Ráp Hoàn Chỉnh</span>
            </button>

            <button
              onClick={() => handleModeChange('exploded')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'exploded'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2. Bóc Tách Đa Tầng 3D</span>
            </button>

            <button
              onClick={() => handleModeChange('ghost')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'ghost'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>3. Làm Mờ Xuyên Thấu (Ghost)</span>
            </button>

            <button
              onClick={() => handleModeChange('solo')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'solo'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>4. Xem Độc Lập 1:1 (Solo)</span>
            </button>
          </div>

          {/* Explode Distance Slider, Quick Layer Stops & Auto Disassemble Button */}
          <div className="flex items-center space-x-2 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-mono flex items-center">
              <Sliders className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Độ Tách:
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={explodeProgress}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onSetExplode(val);
                setIsAutoExploding(false);
                if (viewMode !== 'exploded' && val > 0.05) {
                  setViewMode('exploded');
                }
              }}
              className="w-24 accent-emerald-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono font-bold text-emerald-400 w-9 text-right tabular-nums">
              {Math.round(explodeProgress * 100)}%
            </span>

            <div className="hidden xl:flex items-center space-x-0.5 border-l border-slate-800 pl-2">
              {[0, 0.5, 1].map((presetVal) => (
                <button
                  key={presetVal}
                  onClick={() => {
                    setIsAutoExploding(false);
                    onSetExplode(presetVal);
                    setViewMode(presetVal > 0.05 ? 'exploded' : 'assembly');
                    if (onFocusPartIn3D) {
                      onFocusPartIn3D(currentComp.id, presetVal > 0.05 ? 'exploded' : 'assembly');
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums transition ${
                    Math.abs(explodeProgress - presetVal) < 0.04
                      ? 'bg-emerald-500/25 text-emerald-300 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {Math.round(presetVal * 100)}%
                </button>
              ))}
            </div>

            {/* Auto Disassemble toggle */}
            <button
              onClick={() => setIsAutoExploding(!isAutoExploding)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                isAutoExploding
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
              }`}
              title={isAutoExploding ? 'Dừng bóc tách tự động' : 'Tự động chạy hoạt cảnh tháo lắp 3D'}
            >
              {isAutoExploding ? (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span>Tách Tự Động</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Focus Button & 3D Hotspot Toggle */}
          <div className="flex items-center space-x-2">
            {onToggleHotspots && (
              <button
                onClick={onToggleHotspots}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  areHotspotsVisible
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Bật/Tắt điểm ghim số 3D nổi trên thân robot"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Ghim 3D</span>
              </button>
            )}

            <button
              onClick={handleMacroZoom}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold border border-slate-700 transition"
              title="Phóng to góc nhìn camera vào tâm bộ phận"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              <span>Focus Cận Cảnh</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN WORKBENCH: Left Component Carousel/List + Right Floating Dossier */}
      <div className="flex-1 w-full p-3 flex justify-between items-start pointer-events-none overflow-hidden gap-3">
        {/* LEFT COMPONENT SELECTOR DOCK */}
        <div className="pointer-events-auto flex flex-col space-y-2 max-h-[calc(100vh-160px)] w-72 sm:w-80 shrink-0">
          {/* Category Filter Pills */}
          <div className="bg-slate-950/95 p-1.5 rounded-xl border border-slate-800/90 flex flex-wrap items-center gap-1">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap ${
                categoryFilter === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả (8)
            </button>
            <button
              onClick={() => setCategoryFilter('mechanical')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap ${
                categoryFilter === 'mechanical'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cơ khí (3)
            </button>
            <button
              onClick={() => setCategoryFilter('sensor')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap ${
                categoryFilter === 'sensor'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cảm biến (2)
            </button>
            <button
              onClick={() => setCategoryFilter('compute')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap ${
                categoryFilter === 'compute'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              AI (1)
            </button>
            <button
              onClick={() => setCategoryFilter('electronic')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition whitespace-nowrap ${
                categoryFilter === 'electronic'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mạch (2)
            </button>
          </div>

          {/* Component List */}
          <div className="flex flex-col space-y-1.5 overflow-y-auto max-h-[calc(100vh-210px)] pr-1 scrollbar-thin">
            {filteredComponents.map((comp) => {
              const isSelected = comp.id === currentComp.id;
              const hasPhotos = comp.realPhotos && comp.realPhotos.length > 0;
              return (
                <div
                  key={comp.id}
                  onClick={() => handleSelectComp(comp.id)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900/98 border-emerald-500 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40 translate-x-1'
                      : 'bg-slate-950/92 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border shrink-0 transition ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {comp.id === 'wheels' && <Sliders className="w-4 h-4" />}
                      {comp.id === 'motorBoard' && <Zap className="w-4 h-4" />}
                      {comp.id === 'jetson' && <Cpu className="w-4 h-4" />}
                      {comp.id === 'ports' && <Cable className="w-4 h-4" />}
                      {comp.id === 'lidar' && <SatelliteDish className="w-4 h-4" />}
                      {comp.id === 'camera' && <Camera className="w-4 h-4" />}
                      {comp.id === 'antennas' && <Radio className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`text-xs font-bold truncate ${
                            isSelected ? 'text-emerald-400' : 'text-slate-200'
                          }`}
                        >
                          {comp.nameVi}
                        </h4>
                        {hasPhotos && (
                          <span className="text-[10px] font-mono text-cyan-400/90 flex items-center space-x-1 shrink-0 ml-1 tabular-nums">
                            <ImageIcon className="w-3 h-3" />
                            <span>{comp.realPhotos!.length}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{comp.name}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT TECHNICAL DOSSIER CARD */}
        <div className="pointer-events-auto w-full max-w-[430px] xl:max-w-[460px] flex flex-col max-h-[calc(100vh-160px)]">
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Dossier Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-wider tabular-nums">
                  <span className="text-emerald-400 font-bold">
                    {currentComp.category === 'mechanical'
                      ? 'Cơ khí'
                      : currentComp.category === 'electronic'
                      ? 'Mạch điện tử'
                      : currentComp.category === 'sensor'
                      ? 'Cảm biến'
                      : 'Xử lý AI'}
                  </span>
                  <span className="text-slate-600">&bull;</span>
                  <span className="text-slate-400">
                    Thành phần #{currentIndex + 1}/8
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white mt-1 truncate">
                  {currentComp.nameVi}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-1">{currentComp.name}</p>
              </div>

              {/* Prev / Next & Expand Controls */}
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={handlePrevComp}
                  title="Xem bộ phận trước (Phím mũi tên trái)"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextComp}
                  title="Xem bộ phận tiếp theo (Phím mũi tên phải)"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsDrawerCollapsed(!isDrawerCollapsed)}
                  title={isDrawerCollapsed ? 'Mở rộng hồ sơ' : 'Thu gọn hồ sơ'}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  {isDrawerCollapsed ? (
                    <Maximize2 className="w-4 h-4" />
                  ) : (
                    <Minimize2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Dossier Body (Collapsible) */}
            {!isDrawerCollapsed && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Dossier Navigation Tabs */}
                <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-800/80 bg-slate-950/40 px-2 py-1">
                  <button
                    onClick={() => setActiveInfoTab('functions')}
                    className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                      activeInfoTab === 'functions'
                        ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Chức Năng & AI</span>
                  </button>

                  <button
                    onClick={() => setActiveInfoTab('photos')}
                    className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                      activeInfoTab === 'photos'
                        ? 'bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Ảnh Thật Lab ({currentComp.realPhotos?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveInfoTab('interfaces')}
                    className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                      activeInfoTab === 'interfaces'
                        ? 'bg-teal-500/15 text-teal-400 font-bold border border-teal-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Giao Tiếp & Pinout</span>
                  </button>

                  <button
                    onClick={() => setActiveInfoTab('ros')}
                    className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                      activeInfoTab === 'ros'
                        ? 'bg-purple-500/15 text-purple-400 font-bold border border-purple-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>ROS2 Nodes</span>
                  </button>

                  <button
                    onClick={() => setActiveInfoTab('specs')}
                    className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                      activeInfoTab === 'specs'
                        ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Thông Số</span>
                  </button>

                  <button
                    onClick={() => setActiveInfoTab('lab')}
                    className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap ${
                      activeInfoTab === 'lab'
                        ? 'bg-rose-500/15 text-rose-400 font-bold border border-rose-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Thực Hành CMU</span>
                  </button>
                </div>

                {/* Tab Content Container */}
                <div className="p-4 overflow-y-auto max-h-[50vh] space-y-3.5 text-xs">
                  {/* TAB 1: FUNCTIONS & AI ROLE */}
                  {activeInfoTab === 'functions' && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center">
                          <Info className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                          Tổng quan nguyên lý hoạt động:
                        </h4>
                        <p className="text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                          {currentComp.description}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                          Danh sách chức năng cốt lõi:
                        </h4>
                        <div className="space-y-1.5">
                          {currentComp.functions.map((fn, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex items-start space-x-2"
                            >
                              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span className="text-slate-300 leading-normal">{fn}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-1 flex items-center">
                          <Cpu className="w-3.5 h-3.5 text-purple-400 mr-1.5" />
                          Vai trò trong hệ thống robot tự hành & AI:
                        </h4>
                        <p className="text-slate-300 leading-relaxed bg-purple-950/20 border border-purple-900/50 p-2.5 rounded-xl">
                          {currentComp.aiRole}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: REAL LAB HARDWARE GALLERY & 3D COMPARISON */}
                  {activeInfoTab === 'photos' && (
                    <div className="space-y-3">
                      <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/50 flex items-center justify-between">
                        <span className="text-cyan-300 text-[11px] font-semibold flex items-center">
                          <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                          Hình ảnh phần cứng thật được chụp trực tiếp tại phòng Lab CMU:
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 font-bold">
                          Click ảnh để phóng to
                        </span>
                      </div>

                      {currentComp.realPhotos && currentComp.realPhotos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentComp.realPhotos.map((photo, i) => (
                            <div
                              key={i}
                              onClick={() => setSelectedPhoto(photo)}
                              className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 cursor-pointer hover:border-cyan-500 transition shadow-lg"
                            >
                              <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                                <img
                                  src={photo.url}
                                  alt={photo.perspective}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-white bg-slate-950/90 px-2 py-0.5 rounded-md border border-slate-700">
                                    {photo.perspective}
                                  </span>
                                  <span className="p-1 rounded-md bg-cyan-500 text-slate-950 group-hover:scale-110 transition-transform">
                                    <ZoomIn className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                              <p className="p-2.5 text-[11px] text-slate-300 leading-snug">
                                {photo.caption}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800">
                          Chưa có hình ảnh thật cho bộ phận này
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: INTERFACES & HARDWARE WIRING */}
                  {activeInfoTab === 'interfaces' && (
                    <div className="space-y-2.5">
                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-teal-400 font-bold">
                          Giao thức kết nối (Protocol)
                        </span>
                        <p className="text-slate-200 font-medium">{currentComp.hardwareInterface.protocol}</p>
                      </div>

                      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-teal-400 font-bold">
                          Sơ đồ chân & Vị trí cắm (Pinout)
                        </span>
                        <p className="text-slate-200 font-mono text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800">
                          {currentComp.hardwareInterface.pinout}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">
                            Điện áp làm việc
                          </span>
                          <span className="text-slate-100 font-medium mt-0.5 block">
                            {currentComp.hardwareInterface.voltage}
                          </span>
                        </div>

                        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] font-mono uppercase text-rose-400 font-bold block">
                            Công suất tiêu thụ
                          </span>
                          <span className="text-slate-100 font-medium mt-0.5 block">
                            {currentComp.hardwareInterface.powerConsumption}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: ROS2 NODES & SOFTWARE */}
                  {activeInfoTab === 'ros' && (
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-purple-400 font-bold block mb-1">
                          ROS2 Package tương ứng
                        </span>
                        <code className="text-xs font-mono text-purple-300 bg-purple-950/40 border border-purple-800/60 px-2.5 py-1.5 rounded-lg block">
                          {currentComp.rosNode.packageName}
                        </code>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                          Lệnh khởi chạy (Launch Command)
                        </span>
                        <pre className="text-[11px] font-mono text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto">
                          {currentComp.rosNode.launchCommand}
                        </pre>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                          Các ROS Topics xuất / nhận (Pub/Sub)
                        </span>
                        <div className="space-y-1">
                          {currentComp.rosNode.topics.map((tp, i) => (
                            <div
                              key={i}
                              className="font-mono text-[11px] text-emerald-400 bg-slate-950/90 px-2 py-1 rounded border border-slate-800"
                            >
                              {tp}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: SPECS TABLE */}
                  {activeInfoTab === 'specs' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(currentComp.specs).map(([specKey, specVal]) => (
                        <div
                          key={specKey}
                          className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-center"
                        >
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            {specKey}
                          </span>
                          <span className="text-slate-100 font-medium mt-0.5">{specVal}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 6: PRACTICAL LAB NOTES */}
                  {activeInfoTab === 'lab' && (
                    <div className="space-y-3">
                      <div className="bg-rose-950/20 border border-rose-900/60 p-3 rounded-xl space-y-1.5">
                        <span className="text-xs font-bold text-rose-300 flex items-center">
                          <Wrench className="w-4 h-4 mr-1.5 text-rose-400" />
                          Kinh nghiệm phòng Lab & Cảnh báo an toàn:
                        </span>
                        <p className="text-slate-300 leading-relaxed text-xs">
                          {currentComp.practicalNotes}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULL-SCREEN REAL PHOTO LIGHTBOX MODAL */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4 pointer-events-auto animate-fadeIn"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {selectedPhoto.perspective}
                </span>
                <span className="text-slate-500">&bull;</span>
                <span className="text-xs text-emerald-400 font-mono font-semibold">
                  {currentComp.nameVi}
                </span>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Display */}
            <div className="relative max-h-[65vh] w-full flex items-center justify-center bg-black/80 overflow-hidden">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.perspective}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>

            {/* Modal Footer Caption */}
            <div className="p-4 bg-slate-950 border-t border-slate-800">
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                {selectedPhoto.caption}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

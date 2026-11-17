/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Layers,
  Camera,
  Maximize2,
  Minimize2,
  RotateCw,
  Eye,
  EyeOff,
  Download,
  Ruler,
  Flame,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Sliders,
  Image as ImageIcon,
  ZoomIn,
  X,
  Crosshair,
  Info,
  Cpu,
  MousePointerClick,
} from 'lucide-react';
import {
  JetBotComponentInfo,
  ModelVariant,
  RenderShaderStyle,
} from '../../types/jetbot';
import { resolveJetBotComponent } from '../../data/jetbotComponents';

interface Model3DStudioProps {
  selectedStyle: RenderShaderStyle;
  selectedColorHex: number;
  selectedVariant: ModelVariant;
  showDimensions: boolean;
  autoRotate: boolean;
  rotateSpeed: number;
  partVisibilities: Record<string, boolean>;
  explodeProgress: number;
  selectedPartId: string | null;
  onSelectPart: (partId: string | null) => void;
  onFocusPart: (partId: string) => void;
  onSetExplode: (progress: number) => void;
  onSetRenderStyle: (style: RenderShaderStyle) => void;
  onSetChassisColor: (hex: number) => void;
  onSetPartVisibility: (partId: string, visible: boolean) => void;
  onSetAllPartsVisibility: (visible: boolean) => void;
  onSetDimensionsVisible: (visible: boolean) => void;
  onSetModelVariant: (variant: ModelVariant) => void;
  onSetAutoRotate: (enabled: boolean, speed?: number) => void;
  onSetPresetView: (view: 'isometric' | 'top' | 'front' | 'side' | 'bottom') => void;
  onCaptureSnapshot: () => void;
  onOpenAnatomy: (partId?: string) => void;
  meshStats?: { vertices: number; triangles: number; meshes: number };
}

const CHASSIS_COLORS = [
  { name: 'Xanh Lá NVIDIA Anodized', hex: 0x15803d, css: '#15803d' },
  { name: 'Xanh Dương Metallic', hex: 0x0284c7, css: '#0284c7' },
  { name: 'Đỏ Ruby Titan', hex: 0xdc2626, css: '#dc2626' },
  { name: 'Đen Nhám Stealth', hex: 0x18181b, css: '#18181b' },
  { name: 'Bạc Hợp Kim Nhôm CNC', hex: 0x94a3b8, css: '#94a3b8' },
  { name: 'Vàng Hoàng Gia Gold', hex: 0xeab308, css: '#eab308' },
];

const SHADER_STYLES: { id: RenderShaderStyle; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  {
    id: 'pbr',
    label: 'PBR Thực Tế',
    desc: 'Bề mặt vật lý, phản xạ kim loại & vân lốp gai knobby',
    icon: Sparkles,
    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20',
  },
  {
    id: 'wireframe',
    label: 'Khung Dây (Wireframe)',
    desc: 'Lưới đa giác polygon, hiển thị topology hình học 3D',
    icon: Box,
    color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20',
  },
  {
    id: 'xray',
    label: 'X-Ray Hologram',
    desc: 'Xuyên thấu vi mạch, quan sát kết cấu bên trong khung gầm',
    icon: Maximize2,
    color: 'text-sky-400 border-sky-500/40 bg-sky-950/20',
  },
  {
    id: 'clay',
    label: 'Studio Đất Sét (Clay)',
    desc: 'Đổ bóng mịn mờ trung tính, kiểm tra hình khối và bề mặt',
    icon: Layers,
    color: 'text-slate-300 border-slate-500/40 bg-slate-800/40',
  },
  {
    id: 'thermal',
    label: 'Bản Đồ Nhiệt (Thermal FLIR)',
    desc: 'Mô phỏng phân bố nhiệt CPU (52°C), Mạch nguồn & Động cơ',
    icon: Flame,
    color: 'text-amber-400 border-amber-500/40 bg-amber-950/20',
  },
];

const MODEL_VARIANTS: { id: ModelVariant; name: string; tag: string; desc: string }[] = [
  {
    id: 'rplidar',
    name: 'JetBot + Radar RPLIDAR A1',
    tag: 'Bản Chuẩn Lab CMU',
    desc: 'Trang bị radar quét laser 360° quét vật cản và lập bản đồ 2D/3D SLAM.',
  },
  {
    id: 'standard',
    name: 'JetBot Tiêu Chuẩn',
    tag: 'Camera Đơn IMX219',
    desc: 'Cấu hình nhẹ gọn không LiDAR, chuyên nhận diện vật thể & bám làn đường.',
  },
  {
    id: 'stereo',
    name: 'JetBot Dual-Cam Stereo',
    tag: 'Thị Giác Lập Thể',
    desc: 'Cụm camera kép đo khoảng cách chiều sâu (Stereo Depth) góc rộng.',
  },
];

const COMPONENT_PARTS = [
  { id: 'wheels', canonicalId: 'wheels', name: 'Bánh Xe Mâm Xanh & Động Cơ TT', color: 'bg-blue-500' },
  { id: 'motorBoard', canonicalId: 'motorBoard', name: 'Mạch Mở Rộng Động Cơ Waveshare', color: 'bg-amber-500' },
  { id: 'jetsonNano', canonicalId: 'jetson', name: 'NVIDIA Jetson Nano & Tản Nhiệt', color: 'bg-emerald-400' },
  { id: 'ports', canonicalId: 'ports', name: 'Cụm Cổng Kết Nối Ngoại Vi & GPIO', color: 'bg-sky-400' },
  { id: 'lidar', canonicalId: 'lidar', name: 'Radar Quét Laser RPLIDAR A1', color: 'bg-red-500' },
  { id: 'camera', canonicalId: 'camera', name: 'Camera Mắt Cá Sony IMX219 (CSI)', color: 'bg-cyan-400' },
  { id: 'antennas', canonicalId: 'antennas', name: 'Cặp Anten Kép SMA Wi-Fi 2.4/5GHz', color: 'bg-purple-400' },
  { id: 'stereo', canonicalId: 'stereoCamera', name: 'Cụm Camera Kép Stereo (Biến thể)', color: 'bg-indigo-400' },
];

const CATEGORY_LABEL: Record<JetBotComponentInfo['category'], string> = {
  mechanical: 'Cơ khí',
  electronic: 'Mạch điện tử',
  sensor: 'Cảm biến',
  compute: 'Xử lý AI',
};

export const Model3DStudio: React.FC<Model3DStudioProps> = ({
  selectedStyle,
  selectedColorHex,
  selectedVariant,
  showDimensions,
  autoRotate,
  rotateSpeed,
  partVisibilities,
  explodeProgress,
  selectedPartId,
  onSelectPart,
  onFocusPart,
  onSetExplode,
  onSetRenderStyle,
  onSetChassisColor,
  onSetPartVisibility,
  onSetAllPartsVisibility,
  onSetDimensionsVisible,
  onSetModelVariant,
  onSetAutoRotate,
  onSetPresetView,
  onCaptureSnapshot,
  onOpenAnatomy,
  meshStats = { vertices: 14820, triangles: 24560, meshes: 68 },
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'shaders' | 'variants' | 'parts' | 'cad'>('parts');
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<'isometric' | 'top' | 'front' | 'side' | 'bottom'>('isometric');
  const [copiedCad, setCopiedCad] = useState<boolean>(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; caption: string; perspective: string } | null>(null);

  const selectedComp = resolveJetBotComponent(selectedPartId);
  const photos = selectedComp?.realPhotos ?? [];
  const safePhotoIdx = activePhotoIdx < photos.length ? activePhotoIdx : 0;
  const activePhoto = photos[safePhotoIdx] ?? null;

  // Reset gallery index when switching selected component
  useEffect(() => {
    setActivePhotoIdx(0);
  }, [selectedComp?.id]);

  // Allow Escape to close full-screen lightbox photo
  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxPhoto(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxPhoto]);

  const handlePresetClick = (view: 'isometric' | 'top' | 'front' | 'side' | 'bottom') => {
    setActivePreset(view);
    onSetPresetView(view);
  };

  const handleExportCadJson = () => {
    const data = {
      model: 'NVIDIA Jetson Nano JetBot AI Robot',
      dimensions: {
        lengthMm: 210,
        widthMm: 175,
        heightMm: 165,
        wheelDiameterMm: 65,
        groundClearanceMm: 18,
        weightGrams: 950,
      },
      geometry: {
        vertices: meshStats.vertices,
        triangles: meshStats.triangles,
        totalMeshes: meshStats.meshes,
        coordinateSystem: 'Y-Up, Z-Forward (ROS standard)',
      },
      variant: selectedVariant,
      shaderStyle: selectedStyle,
      explodeProgress,
      exportTimestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jetbot_cad_spec_${selectedVariant}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedCad(true);
    setTimeout(() => setCopiedCad(false), 2500);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 sm:p-4 select-none overflow-hidden">
      {/* 1. TOP HEADER & METRICS BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-900/95 border border-slate-800/90 rounded-2xl p-2.5 sm:px-4 pointer-events-auto shadow-2xl shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              STUDIO MÔ HÌNH 3D &amp; KIỂM TRA CAD
            </h2>
            <p className="text-[11px] text-slate-400">
              Click trực tiếp lên từng bộ phận 3D để xem ảnh thực tế, thông số &amp; chức năng chi tiết
            </p>
          </div>
        </div>

        {/* Mesh Telemetry Metrics & Action Triggers */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
          <div className="flex items-center space-x-3 px-3 py-1 bg-slate-950/90 rounded-lg border border-slate-800 text-slate-300">
            <span>
              <strong className="text-emerald-400">{meshStats.triangles.toLocaleString()}</strong>{' '}
              <span className="text-slate-500">tris</span>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              <strong className="text-cyan-400">{meshStats.vertices.toLocaleString()}</strong>{' '}
              <span className="text-slate-500">verts</span>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              <strong className="text-amber-400">210×175×165</strong>{' '}
              <span className="text-slate-500">mm</span>
            </span>
          </div>

          <button
            onClick={onCaptureSnapshot}
            title="Chụp ảnh Snapshot 3D độ phân giải cao"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
          >
            <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden md:inline">Chụp Ảnh PNG</span>
          </button>

          <button
            onClick={handleExportCadJson}
            title="Tải tệp JSON thông số CAD"
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors border border-slate-700"
          >
            {copiedCad ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">{copiedCad ? 'Đã Xuất!' : 'Xuất CAD'}</span>
          </button>
        </div>
      </div>

      {/* 2. FLOATING CONTROL WORKSPACE (LEFT SIDEBAR + RIGHT INSPECTOR / VIEWPORT DOCK) */}
      <div className="flex flex-col sm:flex-row items-end sm:items-start justify-between gap-3 pointer-events-none mt-2 flex-1 min-h-0">
        {/* Left Sub-Panel: Inspector & Customizer */}
        <div className="w-full sm:w-80 md:w-96 bg-slate-900/95 border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[calc(100vh-175px)] pointer-events-auto">
          {/* Sub-tab navigation + Collapse Toggle */}
          <div className="flex items-center border-b border-slate-800/80 bg-slate-950/60 p-1 gap-1">
            <div className="flex flex-1 gap-0.5">
              <button
                onClick={() => { setActiveSubTab('parts'); setIsDrawerCollapsed(false); }}
                className={`flex-1 py-1.5 px-1.5 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  activeSubTab === 'parts' && !isDrawerCollapsed
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Chi Tiết</span>
              </button>
              <button
                onClick={() => { setActiveSubTab('shaders'); setIsDrawerCollapsed(false); }}
                className={`flex-1 py-1.5 px-1.5 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  activeSubTab === 'shaders' && !isDrawerCollapsed
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Shader</span>
              </button>
              <button
                onClick={() => { setActiveSubTab('variants'); setIsDrawerCollapsed(false); }}
                className={`flex-1 py-1.5 px-1.5 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  activeSubTab === 'variants' && !isDrawerCollapsed
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>Biến Thể</span>
              </button>
              <button
                onClick={() => { setActiveSubTab('cad'); setIsDrawerCollapsed(false); }}
                className={`flex-1 py-1.5 px-1.5 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1 transition-all ${
                  activeSubTab === 'cad' && !isDrawerCollapsed
                    ? 'bg-slate-800 text-emerald-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>CAD</span>
              </button>
            </div>

            <button
              onClick={() => setIsDrawerCollapsed((prev) => !prev)}
              aria-label={isDrawerCollapsed ? 'Mở rộng bảng công cụ' : 'Thu gọn bảng công cụ'}
              title={isDrawerCollapsed ? 'Mở rộng bảng công cụ' : 'Thu gọn bảng để xem toàn bộ JetBot 3D'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            >
              {isDrawerCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Sub-panel content body */}
          {!isDrawerCollapsed && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
              {/* SUBTAB 1: SUB-ASSEMBLIES SELECTION & VISIBILITY */}
              {activeSubTab === 'parts' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Chọn Bộ Phận &amp; Ẩn / Hiện 3D
                    </label>
                    <div className="space-x-2">
                      <button
                        onClick={() => onSetAllPartsVisibility(true)}
                        className="text-[10px] text-emerald-400 hover:underline font-mono"
                      >
                        Hiện Hết
                      </button>
                      <span className="text-slate-600">&bull;</span>
                      <button
                        onClick={() => onSetAllPartsVisibility(false)}
                        className="text-[10px] text-slate-400 hover:underline font-mono"
                      >
                        Ẩn Hết
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {COMPONENT_PARTS.map((part) => {
                      const isVariantDisabled = part.id === 'stereo' && selectedVariant !== 'stereo';
                      const isVisible = (partVisibilities[part.id] ?? true) && !isVariantDisabled;
                      const compMeta = resolveJetBotComponent(part.canonicalId);
                      const thumbUrl = compMeta?.realPhotos?.[0]?.url;
                      const isSelected =
                        selectedComp !== null && selectedComp.id === compMeta?.id;

                      return (
                        <div
                          key={part.id}
                          className={`w-full flex items-center justify-between rounded-xl border transition-all overflow-hidden ${
                            isVariantDisabled
                              ? 'border-slate-900 bg-slate-950/20 text-slate-600 opacity-50'
                              : isSelected
                              ? 'border-emerald-500 bg-emerald-950/25 text-white ring-1 ring-emerald-500/40'
                              : isVisible
                              ? 'border-slate-800 bg-slate-950/50 text-slate-200 hover:border-slate-700'
                              : 'border-slate-900 bg-slate-950/20 text-slate-500 opacity-65'
                          }`}
                        >
                          <button
                            disabled={isVariantDisabled}
                            onClick={() => onSelectPart(part.canonicalId)}
                            className={`flex-1 flex items-center space-x-2.5 p-2 text-left min-w-0 ${
                              isVariantDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={part.name}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-700/80 shrink-0"
                                loading="lazy"
                              />
                            ) : (
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ml-1 ${part.color}`} />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className={`font-semibold text-[11px] truncate ${!isVisible && !isVariantDisabled ? 'line-through' : ''}`}>
                                {part.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {isSelected
                                  ? 'Đang xem ảnh & chức năng'
                                  : isVariantDisabled
                                  ? 'Chưa bật ở tab Biến Thể'
                                  : 'Click xem ảnh & chức năng'}
                              </div>
                            </div>
                          </button>

                          <button
                            disabled={isVariantDisabled}
                            onClick={() => onSetPartVisibility(part.id, !isVisible)}
                            aria-label={`${isVisible ? 'Ẩn' : 'Hiện'} ${part.name}`}
                            title={isVisible ? 'Ẩn khỏi mô hình 3D' : 'Hiện lại trên mô hình 3D'}
                            className={`px-2.5 py-3 border-l border-slate-800/80 transition shrink-0 ${
                              isVariantDisabled
                                ? 'cursor-not-allowed text-slate-700'
                                : 'hover:bg-slate-800/70 cursor-pointer'
                            }`}
                          >
                            {isVisible ? (
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBTAB 2: SHADERS & MATERIALS */}
              {activeSubTab === 'shaders' && (
                <div className="space-y-3.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Chế Độ Hiển Thị Vật Liệu
                    </label>
                    <div className="space-y-2">
                      {SHADER_STYLES.map((style) => {
                        const Icon = style.icon;
                        const isSelected = selectedStyle === style.id;
                        return (
                          <button
                            key={style.id}
                            onClick={() => onSetRenderStyle(style.id)}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start space-x-3 ${
                              isSelected
                                ? `${style.color} ring-1 ring-emerald-400/50 shadow-md`
                                : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300'
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-slate-900/70' : 'bg-slate-900 text-slate-400'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold flex items-center justify-between">
                                <span>{style.label}</span>
                                {isSelected && <span className="text-[10px] text-emerald-400 font-mono">Đang bật</span>}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{style.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chassis Anodized Color Selection */}
                  <div className="pt-2 border-t border-slate-800">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Màu Sơn Khung Nhôm Anodized
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {CHASSIS_COLORS.map((c) => {
                        const isSelected = selectedColorHex === c.hex;
                        return (
                          <button
                            key={c.hex}
                            onClick={() => onSetChassisColor(c.hex)}
                            title={c.name}
                            aria-label={c.name}
                            className={`h-9 rounded-xl border flex items-center justify-center transition-all ${
                              isSelected ? 'ring-2 ring-white scale-105 border-white' : 'border-slate-700 hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.css }}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-white drop-shadow" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 3: MODEL VARIANTS */}
              {activeSubTab === 'variants' && (
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Cấu Hình Biến Thể Phần Cứng 3D
                  </label>
                  <div className="space-y-2.5">
                    {MODEL_VARIANTS.map((v) => {
                      const isSelected = selectedVariant === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => onSetModelVariant(v.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300 ring-1 ring-emerald-500/40 shadow-lg'
                              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white text-xs">{v.name}</span>
                            <span className="text-[10px] font-mono text-emerald-400/90">{v.tag}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{v.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUBTAB 4: CAD SPECS & DIMENSIONS */}
              {activeSubTab === 'cad' && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Ruler className="w-4 h-4 text-cyan-400" />
                        <span className="font-bold text-white text-xs">Hộp Thước Đo 3D CAD</span>
                      </div>
                      <button
                        onClick={() => onSetDimensionsVisible(!showDimensions)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          showDimensions
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {showDimensions ? 'Đang Bật' : 'Bật Thước'}
                      </button>
                    </div>
                    <p className="text-[10px] text-cyan-300/80 leading-relaxed">
                      Hiển thị trực tiếp đường gióng kỹ thuật dài, rộng, cao và khoảng sáng gầm quanh robot.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Bảng Thông Số Kỹ Thuật CAD
                    </label>
                    <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-2.5 space-y-1.5 font-mono text-[11px] tabular-nums">
                      <div className="flex justify-between py-1 border-b border-slate-800/80 text-slate-300">
                        <span className="text-slate-500">Chiều dài (Length):</span>
                        <span className="font-semibold text-cyan-400">210 mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80 text-slate-300">
                        <span className="text-slate-500">Bề rộng vệt bánh:</span>
                        <span className="font-semibold text-cyan-400">175 mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80 text-slate-300">
                        <span className="text-slate-500">Chiều cao tới đỉnh:</span>
                        <span className="font-semibold text-emerald-400">165 mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80 text-slate-300">
                        <span className="text-slate-500">Đường kính bánh xe:</span>
                        <span className="font-semibold text-amber-400">&empty;65 mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80 text-slate-300">
                        <span className="text-slate-500">Khoảng sáng gầm:</span>
                        <span className="font-semibold text-slate-200">18 mm</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/80 text-slate-300">
                        <span className="text-slate-500">Khối lượng:</span>
                        <span className="font-semibold text-purple-400">950 g</span>
                      </div>
                      <div className="flex justify-between py-1 text-slate-300">
                        <span className="text-slate-500">Hệ tọa độ:</span>
                        <span className="font-semibold text-slate-300">Y-Up, Z-Forward</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sub-Panel: Compact Controls + Selected 3D Part Photo & Function Inspector */}
        <div
          className={`flex flex-col items-end gap-2 pointer-events-auto max-h-[calc(100vh-175px)] ${
            selectedComp ? 'w-full sm:w-80 md:w-[350px]' : 'w-56'
          }`}
        >
          {/* Compact Viewport Toolbar (Turntable + Quick Explode + CAD View Presets) */}
          <div className="w-full bg-slate-900/95 border border-slate-800/90 rounded-2xl p-2.5 shadow-2xl space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-1.5">
              <button
                onClick={() => onSetAutoRotate(!autoRotate, rotateSpeed)}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                  autoRotate
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
                <span>Bàn Xoay 360°</span>
              </button>

              {autoRotate ? (
                <div className="flex items-center space-x-1">
                  {[0.5, 1.0, 2.0].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => onSetAutoRotate(true, spd)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                        rotateSpeed === spd
                          ? 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/50'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => onOpenAnatomy(selectedComp?.id)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition"
                >
                  <span>Bóc Tách</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Explode Slider */}
            <div className="flex items-center space-x-2 text-[11px]">
              <span className="text-slate-400 font-medium flex items-center space-x-1 shrink-0">
                <Sliders className="w-3 h-3 text-emerald-400" />
                <span>Tách Lớp:</span>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                aria-label="Tách lớp nhanh 3D"
                value={explodeProgress}
                onChange={(e) => onSetExplode(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono font-bold text-emerald-400 tabular-nums w-8 text-right">
                {Math.round(explodeProgress * 100)}%
              </span>
            </div>

            {/* CAD Camera Angle Presets */}
            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {(
                [
                  { id: 'isometric', label: 'Iso' },
                  { id: 'top', label: 'Trên' },
                  { id: 'front', label: 'Trước' },
                  { id: 'side', label: 'Bên' },
                  { id: 'bottom', label: 'Gầm' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`py-1 rounded-lg text-center font-medium transition-colors ${
                    activePreset === preset.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Selected 3D Part Inspector OR Subtle Prompt Hint */}
          {selectedComp ? (
            <div className="w-full flex-1 min-h-0 bg-slate-900/95 border border-emerald-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* Component Header */}
              <div className="p-3 border-b border-slate-800 bg-slate-950/75 flex items-start justify-between gap-2 shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-wider">
                    <span className="text-emerald-400 font-bold">
                      {CATEGORY_LABEL[selectedComp.category]}
                    </span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="text-cyan-400">Bộ phận đang chọn</span>
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-white mt-0.5 leading-snug">
                    {selectedComp.nameVi}
                  </h3>
                  <p className="text-[10px] text-slate-400 truncate">{selectedComp.name}</p>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => onFocusPart(selectedComp.id)}
                    title="Zoom cận cảnh vào bộ phận này trên mô hình 3D"
                    aria-label="Focus 3D vào bộ phận đang chọn"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 transition"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onSelectPart(null)}
                    title="Đóng bảng thông tin bộ phận"
                    aria-label="Đóng thông tin bộ phận"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Real Photo + Functions + Specs Body */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 text-xs">
                {/* Real Hardware Photo Showcase */}
                {activePhoto && (
                  <div className="space-y-1.5">
                    <div
                      onClick={() => setLightboxPhoto(activePhoto)}
                      className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 cursor-pointer hover:border-cyan-500 transition shadow-lg"
                    >
                      <div className="relative h-36 w-full overflow-hidden bg-slate-950">
                        <img
                          src={activePhoto.url}
                          alt={activePhoto.perspective}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-transparent" />
                        <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-white bg-slate-950/90 px-2 py-0.5 rounded border border-slate-700 truncate">
                            {activePhoto.perspective}
                          </span>
                          <span className="p-1 rounded bg-cyan-500 text-slate-950 shrink-0">
                            <ZoomIn className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                      <p className="px-2.5 py-1.5 text-[11px] text-slate-300 leading-snug bg-slate-950/90">
                        {activePhoto.caption}
                      </p>
                    </div>

                    {photos.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        {photos.map((p, idx) => (
                          <button
                            key={p.url + idx}
                            onClick={() => setActivePhotoIdx(idx)}
                            aria-label={`Xem ảnh ${idx + 1}: ${p.perspective}`}
                            className={`relative flex-1 h-10 rounded-lg overflow-hidden border transition ${
                              idx === safePhotoIdx
                                ? 'border-cyan-400 ring-1 ring-cyan-400/50'
                                : 'border-slate-800 opacity-65 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={p.url}
                              alt={p.perspective}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Overview Description */}
                <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Info className="w-3 h-3 text-emerald-400" />
                    <span>Thông tin cấu tạo</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {selectedComp.description}
                  </p>
                </div>

                {/* Core Functions */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Chức năng chính</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedComp.functions.map((fn, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 flex items-start space-x-2"
                      >
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5 tabular-nums">
                          {idx + 1}
                        </span>
                        <span className="text-[11px] text-slate-300 leading-normal">{fn}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Role */}
                <div className="bg-purple-950/20 border border-purple-900/50 p-2.5 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Cpu className="w-3 h-3 text-purple-400" />
                    <span>Vai trò AI &amp; Tự hành</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{selectedComp.aiRole}</p>
                </div>

                {/* Key Technical Specs */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Thông số kỹ thuật nhanh
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(selectedComp.specs)
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="bg-slate-950/80 p-2 rounded-lg border border-slate-800"
                        >
                          <div className="text-[9px] text-slate-400 uppercase font-semibold truncate">
                            {k}
                          </div>
                          <div className="text-[10px] text-slate-200 font-medium mt-0.5 leading-snug">
                            {v}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Deep Dive Action */}
                <button
                  onClick={() => onOpenAnatomy(selectedComp.id)}
                  className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                >
                  <span>Bóc Tách &amp; Xem ROS2 / Pinout Đầy Đủ</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full bg-slate-900/95 border border-slate-800/90 rounded-2xl p-3 shadow-2xl space-y-2">
              <div className="flex items-start space-x-2 text-[11px] text-slate-300">
                <MousePointerClick className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  <strong className="text-white">Click trực tiếp lên xe 3D</strong> hoặc chọn trong mục{' '}
                  <strong className="text-emerald-400">Chi Tiết</strong> để xem ảnh thực tế, thông tin &amp; chức năng từng bộ phận.
                </span>
              </div>
              <button
                onClick={() => onSelectPart('lidar')}
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Xem thử: RPLIDAR A1</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FULL-SCREEN REAL PHOTO LIGHTBOX MODAL */}
      {lightboxPhoto &&
        selectedComp &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4 pointer-events-auto animate-fadeIn"
            onClick={() => setLightboxPhoto(null)}
          >
            <div
              className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider truncate">
                    {lightboxPhoto.perspective}
                  </span>
                  <span className="text-slate-500">&bull;</span>
                  <span className="text-xs text-emerald-400 font-mono font-semibold truncate">
                    {selectedComp.nameVi}
                  </span>
                </div>
                <button
                  onClick={() => setLightboxPhoto(null)}
                  aria-label="Đóng ảnh phóng to"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative max-h-[65vh] w-full flex items-center justify-center bg-black/80 overflow-hidden">
                <img
                  src={lightboxPhoto.url}
                  alt={lightboxPhoto.perspective}
                  className="max-h-[65vh] w-auto max-w-full object-contain"
                />
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800">
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {lightboxPhoto.caption}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ComponentHotspot } from '../../types/jetbot';
import { Sparkles } from 'lucide-react';

interface ComponentHotspots3DProps {
  hotspots: ComponentHotspot[];
  selectedId: string | null;
  onSelectComponent: (id: string) => void;
  isVisible: boolean;
  onToggleVisible?: () => void;
}

export const ComponentHotspots3D: React.FC<ComponentHotspots3DProps> = ({
  hotspots,
  selectedId,
  onSelectComponent,
  isVisible,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden select-none">
      {/* Dynamic Projected Pins */}
      {hotspots.map((h) => {
        if (!h.visible) return null;
        const isSelected = selectedId === h.id;
        const isHovered = hoveredId === h.id;

        // Scale pins slightly based on distance to mimic depth
        const scale = Math.max(0.75, Math.min(1.15, 3.2 / (h.distance || 3.0)));

        return (
          <div
            key={h.id}
            style={{
              left: `${h.screenX}px`,
              top: `${h.screenY}px`,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
            className="absolute pointer-events-auto cursor-pointer transition-transform duration-75"
            onMouseEnter={() => setHoveredId(h.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectComponent(h.id)}
          >
            <div className="relative flex items-center justify-center">
              {isSelected && (
                <span className="absolute -inset-1.5 rounded-full border border-emerald-400/70 bg-emerald-400/15" />
              )}

              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-extrabold shadow-lg transition-all ${
                  isSelected
                    ? 'bg-emerald-400 text-slate-950 ring-4 ring-emerald-500/50 scale-110 shadow-emerald-400/50'
                    : isHovered
                    ? 'bg-cyan-400 text-slate-950 ring-2 ring-cyan-400/60 scale-105'
                    : 'bg-slate-900/95 text-emerald-400 border border-emerald-500/60 hover:border-emerald-400'
                }`}
              >
                {h.index}
              </div>

              {(isHovered || isSelected) && (
                <div
                  className={`absolute left-9 whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-2xl border animate-fadeIn transition-all z-30 flex items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-slate-900/95 text-emerald-300 border-emerald-500 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950/95 text-slate-200 border-slate-700'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>{h.nameVi}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

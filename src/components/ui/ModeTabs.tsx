/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Gamepad2, Box, Layers, Cpu, FileText } from 'lucide-react';
import { ActiveTab } from '../../types/jetbot';

export type { ActiveTab };

interface ModeTabsProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const ModeTabs: React.FC<ModeTabsProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'sim', label: 'Mô Phỏng & Lái Xe', icon: Gamepad2 },
    { id: 'model3d', label: 'Mô Hình 3D', icon: Box },
    { id: 'anatomy', label: 'Bóc Tách & Cấu Tạo', icon: Layers },
    { id: 'sensors', label: 'Cảm Biến AI & Radar', icon: Cpu },
    { id: 'cmu', label: 'Bài Tập CMU 10A', icon: FileText },
  ] as const;


  return (
    <nav className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isActive
                ? 'bg-emerald-600 text-slate-950 shadow-md shadow-emerald-600/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

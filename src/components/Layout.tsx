import React from 'react';
import { SyncStatusBar } from './SyncStatusBar';
import { Compass, Footprints, Bot, DownloadCloud, User } from 'lucide-react';

export type NavTab = 'explore' | 'routes' | 'assistant' | 'packs' | 'profile';

interface LayoutProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentTab, onTabChange, children }) => {
  const tabs = [
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'routes', label: 'Routes', icon: Footprints },
    { id: 'assistant', label: 'Assistant', icon: Bot },
    { id: 'packs', label: 'Packs', icon: DownloadCloud },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* 1. Sync Status Bar */}
      <SyncStatusBar />

      {/* 2. Main Content Body */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {children}
      </main>

      {/* 3. Bottom Navigation Bar */}
      <nav className="h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 shrink-0 z-30">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as NavTab)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
                isActive ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

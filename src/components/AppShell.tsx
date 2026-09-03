import React from 'react';
import { Icon } from './Icon';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { appState, updateAppState, currentProject } = useData();
  const { logout } = useAuth();
  const [showSettings, setShowSettings] = React.useState(false);

  const handleTabChange = (tab: typeof appState.tab) => {
    updateAppState({ tab });
  };

  const toggleLock = () => {
    updateAppState({ locked: !appState.locked });
  };

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center p-4 md:p-10">
      <div className="w-full max-w-md">
        {/* Phone frame */}
        <div className="bg-surface border border-border rounded-[20px] shadow-phone overflow-hidden">
          {/* Notch */}
          <div className="h-4 flex items-center justify-center">
            <div className="w-16 h-1 bg-border rounded-full" />
          </div>

          {/* Phone screen */}
          <div className="bg-parchment h-[792px] max-h-[90vh] rounded-[14px] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-burgundy text-white px-4 py-3 text-center relative flex-shrink-0">
              <div className="text-xs font-bold tracking-widest uppercase">
                Vineyard Notebook
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-6 h-6 rounded-full bg-white/10 border border-white/30 flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Settings"
                >
                  <Icon name="settings" size={12} />
                </button>
                <button
                  onClick={toggleLock}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                    appState.locked
                      ? 'bg-white/25 border-white/50'
                      : 'bg-white/10 border-white/30 hover:bg-white/20'
                  }`}
                  title={appState.locked ? 'Locked' : 'Unlocked'}
                >
                  <Icon name={appState.locked ? 'lock' : 'unlock'} size={12} />
                </button>
              </div>
            </div>

            {/* Settings overlay */}
            {showSettings && (
              <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-parchment rounded-xl max-w-sm w-full p-6 shadow-phone">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-ink">Settings</h3>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surface-2"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-ink-faint mb-2">
                        Current Project
                      </div>
                      <div className="text-sm font-semibold text-ink">
                        {currentProject?.name || 'No project selected'}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-faint block mb-2">
                        Inventory Alert Days
                      </label>
                      <input
                        type="number"
                        value={appState.alertDays}
                        onChange={(e) =>
                          updateAppState({ alertDays: parseInt(e.target.value) || 14 })
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-ink"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-faint block mb-2">
                        Event Alert Days
                      </label>
                      <input
                        type="number"
                        value={appState.eventAlertDays}
                        onChange={(e) =>
                          updateAppState({ eventAlertDays: parseInt(e.target.value) || 7 })
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-ink"
                        min="1"
                      />
                    </div>

                    <button
                      onClick={() => {
                        logout();
                        setShowSettings(false);
                      }}
                      className="w-full py-2 text-status-need font-semibold hover:underline"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>

            {/* Bottom navigation */}
            <div className="bg-burgundy flex items-center justify-around py-2 px-0 flex-shrink-0">
              {[
                { id: 'timeline', icon: 'timeline', label: 'Timeline' },
                { id: 'tree', icon: 'tree', label: 'Tree' },
                { id: 'calendar', icon: 'calendar', label: 'Calendar' },
                { id: 'crate', icon: 'crate', label: 'Inventory' },
                { id: 'library', icon: 'book', label: 'Library' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as any)}
                  className={`flex flex-col items-center gap-1 p-2 border-t-2 transition-colors min-h-[46px] ${
                    appState.tab === tab.id
                      ? 'border-white text-white'
                      : 'border-transparent text-white/55 hover:text-white/80'
                  }`}
                >
                  <Icon name={tab.icon as any} size={17} />
                  <span className="text-[10px] font-semibold tracking-wide">
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { lazy, Suspense } from 'react';
import { Icon } from './Icon';
import { Header } from './Header';
import { SeasonSelector } from './SeasonSelector';
import { useData } from '../contexts/DataContext';
import { LoadingSpinner } from './LoadingSpinner';

const MembersView = lazy(() =>
  import('../features/members/MembersView').then(({ MembersView }) => ({ default: MembersView }))
);

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { appState, updateAppState, currentProject, connectionStatus, dataError, retryData } = useData();
  const [showSettings, setShowSettings] = React.useState(false);
  const [showMembers, setShowMembers] = React.useState(false);

  const handleTabChange = (tab: typeof appState.tab) => {
    updateAppState({ tab });
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
            {connectionStatus !== 'online' && (
              <div
                role={connectionStatus === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                className={`flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold ${
                  connectionStatus === 'error'
                    ? 'bg-status-need/10 text-status-need'
                    : connectionStatus === 'offline'
                      ? 'bg-gold/20 text-cellar'
                      : 'bg-surface-2 text-ink-soft'
                }`}
              >
                <span>
                  {connectionStatus === 'offline'
                    ? 'Offline — changes will not be marked saved until connection returns.'
                    : connectionStatus === 'reconnecting'
                      ? 'Reconnecting…'
                      : 'Unable to sync the latest data.'}
                </span>
                {connectionStatus === 'error' && dataError && (
                  <button type="button" onClick={retryData} className="shrink-0 underline">
                    Retry
                  </button>
                )}
              </div>
            )}
            <Header 
              onSettingsClick={() => setShowSettings(!showSettings)} 
              onMembersClick={() => setShowMembers(!showMembers)}
            />
            
            {/* Season Selector - hidden in library and inventory views */}
            {appState.tab !== 'library' && appState.tab !== 'inventory' && (
              <SeasonSelector showAddButton={!appState.locked} />
            )}

            {/* Members overlay */}
            {showMembers && (
              <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-parchment rounded-xl max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-phone">
                  <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-parchment z-10">
                    <h3 className="text-lg font-semibold text-ink">Member settings</h3>
                    <button
                      onClick={() => setShowMembers(false)}
                      className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surface-2"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                  <Suspense fallback={<LoadingSpinner label="Loading members" compact />}>
                    <MembersView />
                  </Suspense>
                </div>
              </div>
            )}

            {/* Settings overlay */}
            {showSettings && (
              <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-parchment rounded-xl max-w-sm w-full p-6 shadow-phone">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-ink">Alert settings</h3>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surface-2"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>

                  <div className="space-y-4">


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

                    <div className="text-xs text-ink-faint text-center border-t border-border pt-3">
                      Use the user menu in the header to sign out
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content area */}
            <div id="app-content" className="flex-1 overflow-y-auto">
              {children}
            </div>

            {/* Bottom navigation */}
            <div className="bg-burgundy flex items-center justify-around py-2 px-0 flex-shrink-0">
              {[
                { id: 'timeline', icon: 'timeline', label: 'Timeline' },
                { id: 'tree', icon: 'tree', label: 'Tree' },
                { id: 'calendar', icon: 'calendar', label: 'Calendar' },
                { id: 'inventory', icon: 'crate', label: 'Inventory' },
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

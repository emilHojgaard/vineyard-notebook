import React, { lazy, Suspense } from 'react';
import { Icon } from './Icon';
import { Header } from './Header';
import { SeasonSelector } from './SeasonSelector';
import { Modal } from './Modal';
import { useData } from '../contexts/DataContext';
import { LoadingSpinner } from './LoadingSpinner';
import { ALERT_DAYS_MAX, ALERT_DAYS_MIN, normalizeAlertDays } from '../lib/alert-settings';

const MembersView = lazy(() =>
  import('../features/members/MembersView').then(({ MembersView }) => ({ default: MembersView }))
);

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { appState, updateAppState, connectionStatus, dataError, retryData } = useData();
  const [showSettings, setShowSettings] = React.useState(false);
  const [showMembers, setShowMembers] = React.useState(false);
  const [alertDaysDraft, setAlertDaysDraft] = React.useState(String(appState.alertDays));
  const [eventAlertDaysDraft, setEventAlertDaysDraft] = React.useState(String(appState.eventAlertDays));

  // Keep an empty draft while a field is being edited, but start each opened
  // settings dialog from the values currently held in app state.
  React.useEffect(() => {
    if (!showSettings) return;
    setAlertDaysDraft(String(appState.alertDays));
    setEventAlertDaysDraft(String(appState.eventAlertDays));
  }, [showSettings, appState.alertDays, appState.eventAlertDays]);

  const commitAlertDays = (value: string, current: number, setDraft: (draft: string) => void, key: 'alertDays' | 'eventAlertDays') => {
    const normalized = normalizeAlertDays(value, current);
    setDraft(String(normalized));
    if (normalized !== current) updateAppState({ [key]: normalized });
  };

  const handleSettingsClose = () => {
    commitAlertDays(alertDaysDraft, appState.alertDays, setAlertDaysDraft, 'alertDays');
    commitAlertDays(eventAlertDaysDraft, appState.eventAlertDays, setEventAlertDaysDraft, 'eventAlertDays');
    setShowSettings(false);
  };

  const handleTabChange = (tab: typeof appState.tab) => {
    updateAppState({ tab });
  };

  return (
    <div className="w-full min-h-[100dvh] bg-parchment flex flex-col overflow-hidden">
      {/* The application owns the viewport: internal views keep their own readable padding. */}
      <div className="w-full h-[100dvh] bg-parchment flex flex-col overflow-hidden">
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

            {/* Members dialog */}
            <Modal isOpen={showMembers} onClose={() => setShowMembers(false)} title="Member settings" maxWidth="384px">
              <Suspense fallback={<LoadingSpinner label="Loading members" compact />}>
                <MembersView />
              </Suspense>
            </Modal>

            {/* Settings dialog */}
            <Modal isOpen={showSettings} onClose={handleSettingsClose} title="Alert settings" maxWidth="384px">
              <div className="space-y-4">
                <div>
                  <label htmlFor="inventory-alert-days" className="text-xs uppercase tracking-wider text-ink-faint block mb-2">
                    Inventory Alert Days
                  </label>
                  <input
                    id="inventory-alert-days"
                    type="number"
                    value={alertDaysDraft}
                    onChange={(e) => setAlertDaysDraft(e.target.value)}
                    onBlur={() => commitAlertDays(alertDaysDraft, appState.alertDays, setAlertDaysDraft, 'alertDays')}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-ink"
                    min={ALERT_DAYS_MIN}
                    max={ALERT_DAYS_MAX}
                    step="1"
                  />
                </div>

                <div>
                  <label htmlFor="event-alert-days" className="text-xs uppercase tracking-wider text-ink-faint block mb-2">
                    Event Alert Days
                  </label>
                  <input
                    id="event-alert-days"
                    type="number"
                    value={eventAlertDaysDraft}
                    onChange={(e) => setEventAlertDaysDraft(e.target.value)}
                    onBlur={() => commitAlertDays(eventAlertDaysDraft, appState.eventAlertDays, setEventAlertDaysDraft, 'eventAlertDays')}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-ink"
                    min={ALERT_DAYS_MIN}
                    max={ALERT_DAYS_MAX}
                    step="1"
                  />
                </div>

                <div className="text-xs text-ink-faint text-center border-t border-border pt-3">
                  Use the user menu in the header to sign out
                </div>
              </div>
            </Modal>

            {/* Content area */}
            <div id="app-content" className="min-w-0 flex-1 overflow-y-auto">
              {children}
            </div>

            {/* Bottom navigation */}
            <div className="safe-area-bottom bg-burgundy flex items-center justify-around py-2 px-0 flex-shrink-0">
              {([
                { id: 'timeline', icon: 'timeline', label: 'Timeline' },
                { id: 'tree', icon: 'tree', label: 'Tree' },
                { id: 'calendar', icon: 'calendar', label: 'Calendar' },
                { id: 'inventory', icon: 'crate', label: 'Inventory' },
                { id: 'library', icon: 'book', label: 'Library' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex flex-col items-center gap-1 p-2 border-t-2 transition-colors min-h-[46px] ${
                    appState.tab === tab.id
                      ? 'border-white text-white'
                      : 'border-transparent text-white/55 hover:text-white/80'
                  }`}
                >
                  <Icon name={tab.icon} size={17} />
                  <span className="text-[10px] font-semibold tracking-wide">
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
    </div>
  );
}

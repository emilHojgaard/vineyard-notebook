import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import type { Node, Event } from '../../types';
import { parseDate, fmtDate, walkNodes, branchColor, TRUNK_COLOR } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { generateICS, downloadICS } from '../../lib/calendar-export';
import { CalendarSubscriptionModal } from './CalendarSubscriptionModal';
import { notifyError } from '../../lib/notifications';
import { DayEventsModal } from './DayEventsModal';
import { DataState } from '../../components/DataState';

interface CalendarEvent {
  id: string;
  type: 'phase' | 'check';
  title: string;
  date: string;
  nodeId: string;
  color: string;
  checkName?: string;
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function CalendarView() {
  const { seasons, appState, updateAppState, dataLoading, dataError, connectionStatus, retryData } = useData();
  const season = seasons[appState.year];
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [eventsRevision, setEventsRevision] = useState(0);

  // Get the season year for calendar display
  const seasonYear = season ? parseInt(season.title) : new Date().getFullYear();

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (appState.calMonth) {
      return appState.calMonth;
    }
    // Default to January of the season's year
    return `${seasonYear}-01`;
  });

  // Extract all calendar events from the season
  const allEvents = useMemo(() => {
    if (!season) return [];

    const events: CalendarEvent[] = [];
    let colorIndex = 0;

    function walkWithColor(nodes: Node[], parentColor: string) {
      nodes.forEach((node) => {
        // Add phase start/end as events
        if (node.start) {
          events.push({
            id: `${node.id}-start`,
            type: 'phase',
            title: node.name,
            date: node.start,
            nodeId: node.id,
            color: parentColor,
          });
        }
        if (node.end && node.end !== node.start) {
          events.push({
            id: `${node.id}-end`,
            type: 'phase',
            title: node.name,
            date: node.end,
            nodeId: node.id,
            color: parentColor,
          });
        }

        // Add sub-events/checks
        node.events.forEach((event) => {
          events.push({
            id: event.id,
            type: 'check',
            title: node.name,
            date: event.date,
            nodeId: node.id,
            color: parentColor,
            checkName: event.name,
          });
        });

        // Walk branches
        if (node.branches) {
          node.branches.forEach((branch, idx) => {
            const branchAccent = branchColor(parentColor, idx);
            walkWithColor(branch.nodes, branchAccent);
          });
        }
      });
    }

    walkWithColor(season.root, TRUNK_COLOR);
    return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [season, eventsRevision]);

  // A null month is an explicit reset: current-year seasons open on this
  // month's calendar, while other seasons open at their first event. A
  // selected month remains stable when the view remounts or data refreshes.
  useEffect(() => {
    if (!season) return;
    if (appState.calMonth) {
      setCurrentMonth(appState.calMonth);
      return;
    }

    const year = parseInt(season.title);
    const now = new Date();
    if (year === now.getFullYear()) {
      setCurrentMonth(formatMonth(now));
    } else if (allEvents.length > 0) {
      setCurrentMonth(allEvents[0].date.slice(0, 7));
    } else {
      setCurrentMonth(`${year}-01`);
    }
  }, [appState.calMonth, appState.year, season?.title, allEvents]);

  const hasSeasons = Object.keys(seasons).length > 0;

  if (!hasSeasons) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-sm mx-auto">
          <div className="text-lg font-semibold text-ink mb-2">
            No Seasons Yet
          </div>
          <p className="text-sm text-ink-soft mb-4">
            Create your first season in the Timeline tab to see calendar events
          </p>
        </div>
      </div>
    );
  }

  if (dataLoading || dataError) {
    return <DataState loading={dataLoading} error={dataError} connectionStatus={connectionStatus} onRetry={retryData} label="calendar" />;
  }

  if (!season) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-sm mx-auto">
          <div className="text-lg font-semibold text-ink mb-2">
            No season for {appState.year}
          </div>
          <p className="text-sm text-ink-soft mb-4">
            Go to Timeline to create this season or select a different year
          </p>
          <button
            onClick={() => {
              const years = Object.keys(seasons).map(Number).sort((a, b) => b - a);
              if (years.length > 0) {
                updateAppState({ year: years[0] });
              }
            }}
            className="px-6 py-2 bg-burgundy text-white font-semibold rounded-lg hover:bg-burgundy-deep transition-colors"
          >
            Go to Latest Season
          </button>
        </div>
      </div>
    );
  }

  const [year, month] = currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Get day of week for first day (0 = Sunday)
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  // Build calendar grid
  const calendarDays: Array<{
    day: number | null;
    date: string;
    isToday: boolean;
    events: CalendarEvent[];
  }> = [];

  // Empty cells before first day
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push({ day: null, date: '', isToday: false, events: [] });
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = allEvents.filter((e) => e.date === dateStr);
    calendarDays.push({
      day,
      date: dateStr,
      isToday: dateStr === todayStr,
      events: dayEvents,
    });
  }

  const moveMonth = (offset: number) => {
    const date = new Date(year, month - 1 + offset, 1);
    const newMonthStr = formatMonth(date);
    setCurrentMonth(newMonthStr);
    updateAppState({ calMonth: newMonthStr });
  };

  const handleToday = () => {
    const todayMonth = formatMonth(new Date());
    setCurrentMonth(todayMonth);
    updateAppState({ calMonth: todayMonth });
  };



  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-surface px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
            className="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded-md text-ink hover:bg-surface-2 transition-colors"
          >
            <Icon name="chevronleft" size={16} />
          </button>
          <div className="text-center" aria-live="polite" aria-atomic="true">
            <div className="text-base font-bold text-ink">
              {monthNames[month - 1]} {year}
            </div>
            <button
              type="button"
              onClick={handleToday}
              aria-label="Go to today"
              className={`mt-1 text-xs font-semibold hover:underline ${currentMonth === formatMonth(new Date()) ? 'text-ink-faint' : 'text-burgundy'}`}
            >
              Today
            </button>
          </div>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="Next month"
            className="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded-md text-ink hover:bg-surface-2 transition-colors"
          >
            <Icon name="chevronright" size={16} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Calendar grid */}
        <div className="mb-6">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dow) => (
              <div key={dow} className="text-center text-xs font-semibold text-ink-faint py-1">
                {dow}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`${monthNames[month - 1]} ${year}`}>
            {calendarDays.map((dayData, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => dayData.day !== null && setSelectedDay(dayData.date)}
                disabled={dayData.day === null}
                aria-label={dayData.day === null
                  ? undefined
                  : `${monthNames[month - 1]} ${dayData.day}, ${year}${dayData.events.length ? `, ${dayData.events.length} event${dayData.events.length === 1 ? '' : 's'}` : ''}`}
                aria-current={dayData.isToday ? 'date' : undefined}
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-sm relative transition-all ${
                  dayData.day === null
                    ? 'bg-transparent cursor-default'
                    : dayData.isToday
                    ? 'bg-surface border-2 border-burgundy font-bold hover:bg-surface-2 cursor-pointer'
                    : 'bg-surface border border-border hover:bg-surface-2 cursor-pointer'
                }`}
              >
                {dayData.day !== null && (
                  <>
                    <span className="text-ink">{dayData.day}</span>
                    {dayData.events.length > 0 && (
                      <div className="flex gap-0.5 mt-1" aria-hidden="true">
                        {dayData.events.slice(0, 3).map((event, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full"
                            style={{ backgroundColor: event.color }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar subscription button */}
        <button
          onClick={() => setShowSubscriptionModal(true)}
          className="w-full mt-6 px-4 py-3 bg-surface border border-border rounded-lg text-ink font-semibold text-sm hover:bg-surface-2 transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="link" size={14} />
          Subscribe to Calendar
        </button>

        {/* Export button */}
        <button
          onClick={() => {
            const icsContent = generateICS(allEvents, season.title);
            if (icsContent) {
              downloadICS(icsContent, `vineyard-calendar-${season.title}.ics`);
            } else {
              notifyError('No events to export or error generating calendar file.');
            }
          }}
          disabled={allEvents.length === 0}
          className="w-full mt-3 px-4 py-3 border-2 border-dashed border-border rounded-lg text-ink-faint font-semibold text-sm hover:text-ink-soft hover:border-barrel transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-ink-faint disabled:hover:border-border"
        >
          <Icon name="download" size={14} />
          Download .ics file
          {allEvents.length > 0 && (
            <span className="text-xs">({allEvents.length} events)</span>
          )}
        </button>
      </div>

      {/* Day Events Modal */}
      <DayEventsModal
        isOpen={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        date={selectedDay || ''}
        events={selectedDay ? allEvents.filter((event) => event.date === selectedDay) : []}
        onUpdate={() => setEventsRevision((revision) => revision + 1)}
        isArchived={season?.status !== 'current'}
      />

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <CalendarSubscriptionModal
          onClose={() => setShowSubscriptionModal(false)}
          seasonYear={appState.year}
        />
      )}
    </div>
  );
}

export default CalendarView;

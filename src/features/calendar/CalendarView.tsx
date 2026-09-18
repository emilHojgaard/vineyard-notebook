import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import type { Node, Event } from '../../types';
import { parseDate, fmtDate, walkNodes, branchColor, TRUNK_COLOR } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { generateICS, downloadICS } from '../../lib/calendar-export';
import { CalendarSubscriptionModal } from './CalendarSubscriptionModal';

interface CalendarEvent {
  id: string;
  type: 'phase' | 'check';
  title: string;
  date: string;
  nodeId: string;
  color: string;
  checkName?: string;
}

export function CalendarView() {
  const { seasons, appState, updateAppState } = useData();
  const season = seasons[appState.year];
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

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
  }, [season]);

  // Update calendar month when season changes (smart start date logic)
  useEffect(() => {
    if (season && !appState.calMonth) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const year = parseInt(season.title);
      
      if (year === currentYear) {
        // Current year: start on today's month
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setCurrentMonth(monthStr);
      } else if (allEvents.length > 0) {
        // Different year: start on first event's month
        const firstEventDate = allEvents[0].date;
        const [eventYear, eventMonth] = firstEventDate.split('-');
        setCurrentMonth(`${eventYear}-${eventMonth}`);
      } else {
        // No events: default to January of season year
        setCurrentMonth(`${year}-01`);
      }
      updateAppState({ calMonth: null });
    }
  }, [appState.year, season?.title, allEvents]);

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

  const handlePrevMonth = () => {
    const newMonth = month === 1 ? 12 : month - 1;
    const newYear = month === 1 ? year - 1 : year;
    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setCurrentMonth(newMonthStr);
    updateAppState({ calMonth: newMonthStr });
  };

  const handleNextMonth = () => {
    const newMonth = month === 12 ? 1 : month + 1;
    const newYear = month === 12 ? year + 1 : year;
    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
    setCurrentMonth(newMonthStr);
    updateAppState({ calMonth: newMonthStr });
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
            onClick={handlePrevMonth}
            className="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded-md text-ink hover:bg-surface-2 transition-colors"
          >
            <Icon name="chevronleft" size={16} />
          </button>
          <div className="text-center">
            <div className="text-base font-bold text-ink">
              {monthNames[month - 1]} {year}
            </div>
          </div>
          <button
            onClick={handleNextMonth}
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
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((dayData, idx) => (
              <div
                key={idx}
                className={`aspect-square rounded-md flex flex-col items-center justify-center text-sm relative ${
                  dayData.day === null
                    ? 'bg-transparent'
                    : dayData.isToday
                    ? 'bg-surface border-2 border-burgundy font-bold'
                    : 'bg-surface border border-border'
                }`}
              >
                {dayData.day !== null && (
                  <>
                    <span className="text-ink">{dayData.day}</span>
                    {dayData.events.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
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
              </div>
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
              alert('No events to export or error generating calendar file.');
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

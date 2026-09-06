import { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import type { Node, Event } from '../../types';
import { parseDate, fmtDate, walkNodes, branchColor, TRUNK_COLOR } from '../../lib/utils';
import { Icon } from '../../components/Icon';

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

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (appState.calMonth) {
      return appState.calMonth;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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

  const handleToday = () => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(monthStr);
    updateAppState({ calMonth: null });
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

  // Get upcoming events for agenda (next 30 days from today)
  const upcomingEvents = allEvents.filter((e) => {
    const eventDate = parseDate(e.date);
    const daysDiff = Math.ceil((eventDate.getTime() - today.getTime()) / 86400000);
    return daysDiff >= 0 && daysDiff <= 30;
  });

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
        <button
          onClick={handleToday}
          className="w-full px-3 py-2 text-sm font-semibold text-burgundy bg-surface border border-border rounded-md hover:bg-surface-2 transition-colors"
        >
          Today
        </button>
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

        {/* Agenda */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-3">
            Upcoming (Next 30 days)
          </h3>
          {upcomingEvents.length === 0 ? (
            <div className="text-sm text-ink-faint text-center py-6">
              No upcoming events
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 px-3 py-3 bg-surface border border-border rounded-md"
                >
                  <div
                    className="w-1 h-full min-h-[30px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">
                      {event.title}
                      {event.type === 'check' && (
                        <span className="ml-2 text-xs font-bold uppercase tracking-wide text-ink-faint border border-border rounded px-1.5 py-0.5">
                          {event.checkName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-soft mt-0.5">{fmtDate(event.date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Export button (placeholder) */}
        <button
          onClick={() => alert('Calendar export coming soon!')}
          className="w-full mt-6 px-4 py-3 border-2 border-dashed border-border rounded-lg text-ink-faint font-semibold text-sm hover:text-ink-soft hover:border-barrel transition-colors flex items-center justify-center gap-2"
        >
          <Icon name="download" size={14} />
          Export to calendar (.ics)
        </button>
      </div>
    </div>
  );
}

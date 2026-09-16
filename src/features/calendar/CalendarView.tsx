import { useState, useMemo, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import type { Node, Event } from '../../types';
import { parseDate, fmtDate, walkNodes, branchColor, TRUNK_COLOR } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';

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
  const { seasons, appState, updateAppState, updateSeason } = useData();
  const season = seasons[appState.year];
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');

  const isLocked = appState.locked;
  const isArchived = season?.status !== 'current';

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

  const handleDateClick = (date: string, events: CalendarEvent[]) => {
    setSelectedDate(date);
    setSelectedDateEvents(events);
    setIsAddingEvent(false);
    setNewEventName('');
    setSelectedPhaseId('');
  };

  // Get all phases (nodes) for the phase selector
  const allPhases = useMemo(() => {
    if (!season) return [];
    const phases: Array<{ id: string; name: string }> = [];
    walkNodes(season.root, (node) => {
      phases.push({ id: node.id, name: node.name });
    });
    return phases;
  }, [season]);

  const handleAddEvent = async () => {
    if (!newEventName.trim() || !selectedPhaseId || !selectedDate || !season) return;

    // Find the node and add the event
    let nodeFound = false;
    const updatedSeason = { ...season };
    
    walkNodes(updatedSeason.root, (node) => {
      if (node.id === selectedPhaseId) {
        node.events.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: newEventName.trim(),
          date: selectedDate,
        });
        nodeFound = true;
      }
    });

    if (nodeFound) {
      await updateSeason(appState.year, updatedSeason);
      setIsAddingEvent(false);
      setNewEventName('');
      setSelectedPhaseId('');
      // Refresh the selected date events
      const newEvents = allEvents.filter((e) => e.date === selectedDate);
      setSelectedDateEvents(newEvents);
    }
  };

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
              <button
                key={idx}
                onClick={() => dayData.day !== null && handleDateClick(dayData.date, dayData.events)}
                disabled={dayData.day === null}
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
              </button>
            ))}
          </div>
        </div>

        {/* Hint text */}
        <div className="text-center text-sm text-ink-faint mt-4">
          Click any date to view events
        </div>
      </div>

      {/* Day events modal */}
      {selectedDate && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedDate(null);
            setSelectedDateEvents([]);
            setIsAddingEvent(false);
            setNewEventName('');
            setSelectedPhaseId('');
          }}
          title={fmtDate(selectedDate)}
        >
          {/* Event list */}
          {selectedDateEvents.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-ink-soft mb-2">No events on this day</p>
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {selectedDateEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 px-3 py-3 bg-surface border border-border rounded-md"
                >
                  <div
                    className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink mb-1">
                      {event.title}
                    </div>
                    {event.type === 'check' && (
                      <div className="text-xs font-bold uppercase tracking-wide text-ink-faint border border-border rounded px-2 py-1 inline-block">
                        {event.checkName}
                      </div>
                    )}
                    {event.type === 'phase' && (
                      <div className="text-xs text-ink-soft">
                        Phase {event.id.includes('-end') ? 'end' : 'start'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add event section */}
          {!isLocked && !isArchived && allPhases.length > 0 && (
            <div className="border-t border-border pt-4">
              {!isAddingEvent ? (
                <button
                  onClick={() => setIsAddingEvent(true)}
                  className="w-full px-4 py-2 border-2 border-dashed border-border rounded-lg text-ink-soft font-semibold text-sm hover:text-burgundy hover:border-burgundy transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="plus" size={14} />
                  Add Event
                </button>
              ) : (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-3">
                    Add Event to This Day
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-faint block mb-2">
                        Select Phase
                      </label>
                      <select
                        value={selectedPhaseId}
                        onChange={(e) => setSelectedPhaseId(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm font-semibold"
                      >
                        <option value="">Choose a phase...</option>
                        {allPhases.map((phase) => (
                          <option key={phase.id} value={phase.id}>
                            {phase.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-faint block mb-2">
                        Event Name
                      </label>
                      <input
                        type="text"
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddEvent()}
                        placeholder="e.g. Check pH levels"
                        className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddEvent}
                        disabled={!newEventName.trim() || !selectedPhaseId}
                        className="flex-1 px-3 py-2 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Add Event
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingEvent(false);
                          setNewEventName('');
                          setSelectedPhaseId('');
                        }}
                        className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state when no phases exist */}
          {!isLocked && !isArchived && allPhases.length === 0 && (
            <div className="border-t border-border pt-4 text-center">
              <p className="text-sm text-ink-faint">
                Create phases in the Timeline tab first
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default CalendarView;

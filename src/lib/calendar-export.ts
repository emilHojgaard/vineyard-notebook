import { createEvents } from 'ics';
import type { EventAttributes, DateArray } from 'ics';

interface CalendarEvent {
  id: string;
  type: 'phase' | 'check';
  title: string;
  date: string;
  nodeId: string;
  color: string;
  checkName?: string;
}

/**
 * Convert ISO date string (YYYY-MM-DD) to ics DateArray format
 * DateArray is [year, month, day] where month is 1-12
 */
function dateToArray(dateStr: string): DateArray {
  const [year, month, day] = dateStr.split('-').map(Number);
  return [year, month, day];
}

/**
 * Export calendar events to .ics format
 * @param events - Array of calendar events
 * @returns .ics file content as string, or null if error
 */
export function generateICS(events: CalendarEvent[]): string | null {
  if (events.length === 0) {
    return null;
  }

  const icsEvents: EventAttributes[] = events.map((event) => {
    const eventDate = dateToArray(event.date);
    
    // Build event title
    let title = event.title;
    if (event.type === 'check' && event.checkName) {
      title = `${event.title}: ${event.checkName}`;
    } else if (event.type === 'phase') {
      // Determine if this is start or end by checking the event ID
      const isEnd = event.id.endsWith('-end');
      title = isEnd ? `${event.title} (End)` : `${event.title} (Start)`;
    }

    // Build description
    let description = '';
    if (event.type === 'phase') {
      const isEnd = event.id.endsWith('-end');
      description = isEnd 
        ? `End of ${event.title} phase`
        : `Start of ${event.title} phase`;
    } else if (event.type === 'check') {
      description = `${event.checkName || 'Check'} for ${event.title}`;
    }

    // Create all-day event
    return {
      title,
      description,
      start: eventDate,
      startInputType: 'local',
      startOutputType: 'local',
      // For all-day events, duration is 1 day
      duration: { days: 1 },
      productId: 'vineyard-notebook',
      uid: event.id,
    };
  });

  try {
    const { error, value } = createEvents(icsEvents);
    if (error) {
      console.error('Error creating .ics events:', error);
      return null;
    }
    return value || null;
  } catch (err) {
    console.error('Error generating .ics file:', err);
    return null;
  }
}

/**
 * Trigger browser download of .ics file
 * @param icsContent - The .ics file content
 * @param filename - Filename for the download
 */
export function downloadICS(icsContent: string, filename: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

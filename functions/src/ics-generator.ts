import { createEvents, EventAttributes, DateArray } from 'ics';

interface Node {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  events: Array<{ id: string; name: string; date: string }>;
  branches: Array<{ id: string; name: string; nodes: Node[] }> | null;
}

interface Season {
  title: string;
  root: Node[];
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
 * Extract all events from season tree
 */
function extractEvents(nodes: Node[], events: EventAttributes[] = []): EventAttributes[] {
  nodes.forEach((node) => {
    // Add phase start
    if (node.start) {
      const eventDate = dateToArray(node.start);
      events.push({
        title: `${node.name} (Start)`,
        description: `Start of ${node.name} phase`,
        start: eventDate,
        startInputType: 'local',
        startOutputType: 'local',
        duration: { days: 1 },
        productId: 'vineyard-notebook',
        uid: `${node.id}-start`,
      });
    }

    // Add phase end
    if (node.end && node.end !== node.start) {
      const eventDate = dateToArray(node.end);
      events.push({
        title: `${node.name} (End)`,
        description: `End of ${node.name} phase`,
        start: eventDate,
        startInputType: 'local',
        startOutputType: 'local',
        duration: { days: 1 },
        productId: 'vineyard-notebook',
        uid: `${node.id}-end`,
      });
    }

    // Add sub-events/checks
    node.events.forEach((event) => {
      const eventDate = dateToArray(event.date);
      events.push({
        title: `${node.name}: ${event.name}`,
        description: `${event.name} for ${node.name}`,
        start: eventDate,
        startInputType: 'local',
        startOutputType: 'local',
        duration: { days: 1 },
        productId: 'vineyard-notebook',
        uid: event.id,
      });
    });

    // Recurse into branches
    if (node.branches) {
      node.branches.forEach((branch) => {
        extractEvents(branch.nodes, events);
      });
    }
  });

  return events;
}

/**
 * Generate ICS calendar from season data
 */
export function generateCalendar(season: Season): string | null {
  const events = extractEvents(season.root);

  if (events.length === 0) {
    return null;
  }

  try {
    const { error, value } = createEvents(events);
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

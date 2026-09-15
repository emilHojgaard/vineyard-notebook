"use strict";
/**
 * Generate iCalendar (.ics) file content from season data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateICS = generateICS;
/**
 * Format date for iCalendar format (YYYYMMDD)
 */
function formatICSDate(dateStr) {
    if (!dateStr)
        return '';
    const [year, month, day] = dateStr.split('-');
    return `${year}${month}${day}`;
}
/**
 * Walk all nodes in the tree and collect events
 */
function walkNodes(nodes, callback) {
    nodes.forEach(node => {
        callback(node);
        if (node.branches) {
            node.branches.forEach(branch => {
                walkNodes(branch.nodes, callback);
            });
        }
    });
}
/**
 * Extract all calendar events from season data
 */
function extractEvents(season) {
    const events = [];
    walkNodes(season.root, (node) => {
        // Add phase start as event
        if (node.start) {
            events.push({
                uid: `${node.id}-start`,
                summary: `${node.name} - Start`,
                dtstart: formatICSDate(node.start),
                description: `Phase: ${node.name}`,
            });
        }
        // Add phase end as event (if different from start)
        if (node.end && node.end !== node.start) {
            events.push({
                uid: `${node.id}-end`,
                summary: `${node.name} - End`,
                dtstart: formatICSDate(node.end),
                description: `Phase: ${node.name}`,
            });
        }
        // Add sub-events (checks)
        node.events.forEach((event) => {
            events.push({
                uid: event.id,
                summary: `${node.name} - ${event.name}`,
                dtstart: formatICSDate(event.date),
                description: `Check: ${event.name}\nPhase: ${node.name}`,
            });
        });
    });
    return events;
}
/**
 * Generate iCalendar (.ics) file content
 */
function generateICS(season, projectName) {
    const events = extractEvents(season);
    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    let ics = 'BEGIN:VCALENDAR\r\n';
    ics += 'VERSION:2.0\r\n';
    ics += 'PRODID:-//Vineyard Notebook//Calendar Feed//EN\r\n';
    ics += 'CALSCALE:GREGORIAN\r\n';
    ics += 'METHOD:PUBLISH\r\n';
    ics += `X-WR-CALNAME:${projectName} - ${season.title}\r\n`;
    ics += 'X-WR-TIMEZONE:UTC\r\n';
    ics += `X-WR-CALDESC:Vineyard activities for ${projectName} (${season.title})\r\n`;
    events.forEach(event => {
        ics += 'BEGIN:VEVENT\r\n';
        ics += `UID:${event.uid}@vineyard-notebook.app\r\n`;
        ics += `DTSTAMP:${dtstamp}\r\n`;
        ics += `DTSTART;VALUE=DATE:${event.dtstart}\r\n`;
        if (event.dtend) {
            ics += `DTEND;VALUE=DATE:${event.dtend}\r\n`;
        }
        ics += `SUMMARY:${event.summary}\r\n`;
        if (event.description) {
            // Escape special characters and wrap long lines
            const desc = event.description.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
            ics += `DESCRIPTION:${desc}\r\n`;
        }
        ics += 'END:VEVENT\r\n';
    });
    ics += 'END:VCALENDAR\r\n';
    return ics;
}
//# sourceMappingURL=ics-generator.js.map
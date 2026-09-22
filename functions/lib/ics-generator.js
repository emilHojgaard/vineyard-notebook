"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCalendar = generateCalendar;
const ics_1 = require("ics");
function seasonRoot(season) {
    if (season.root)
        return season.root;
    const content = season.content || {};
    const join = (nodes) => nodes.map((node) => {
        var _a;
        return (Object.assign(Object.assign(Object.assign({}, node), (content[node.id] || { start: '', end: '', events: [] })), { branches: ((_a = node.branches) === null || _a === void 0 ? void 0 : _a.map((branch) => (Object.assign(Object.assign({}, branch), { nodes: join(branch.nodes) })))) || null }));
    });
    return join(season.structure || []);
}
/**
 * Convert ISO date string (YYYY-MM-DD) to ics DateArray format
 * DateArray is [year, month, day] where month is 1-12
 */
function dateToArray(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return [year, month, day];
}
/**
 * Extract all events from season tree
 */
function extractEvents(nodes, events = []) {
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
function generateCalendar(season) {
    const events = extractEvents(seasonRoot(season));
    if (events.length === 0) {
        return null;
    }
    try {
        const { error, value } = (0, ics_1.createEvents)(events);
        if (error) {
            console.error('Error creating .ics events:', error);
            return null;
        }
        return value || null;
    }
    catch (err) {
        console.error('Error generating .ics file:', err);
        return null;
    }
}
//# sourceMappingURL=ics-generator.js.map
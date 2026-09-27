import type { Inventory, Node } from '../types';
import { daysUntil, invStatus } from './utils';

export interface PhaseAlert {
  text: string;
  type: 'event' | 'inv';
}

/**
 * Resolve the alert shown for a phase in every view. Event alerts take
 * precedence over inventory alerts, matching the shared alert settings.
 */
export function getPhaseAlert(
  node: Node,
  inventory: Inventory | undefined,
  alertDays: number,
  eventAlertDays: number,
): PhaseAlert | null {
  const upcomingEvents = node.events.filter((event) => {
    const days = daysUntil(event.date);
    return node.status !== 'done' && days !== null && days <= eventAlertDays;
  });

  if (upcomingEvents.length > 0) {
    return {
      text: upcomingEvents.length === 1
        ? `"${upcomingEvents[0].name}" is coming up`
        : `${upcomingEvents.length} checks coming up`,
      type: 'event',
    };
  }

  if (inventory && node.invIds.length > 0) {
    const days = daysUntil(node.start);
    if (node.status !== 'done' && days !== null && days <= alertDays) {
      const shortItems = node.invIds
        .map((inventoryId) => {
          for (const section of inventory.sections) {
            const item = section.items.find((candidate) => candidate.id === inventoryId);
            if (item && invStatus(item) !== 'have') return item;
          }
          return null;
        })
        .filter(Boolean);

      if (shortItems.length > 0) {
        return {
          text: shortItems.length === 1
            ? `Short on ${shortItems[0]!.name}`
            : `Short on ${shortItems.length} items`,
          type: 'inv',
        };
      }
    }
  }

  return null;
}

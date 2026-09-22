import type { Node, PhaseStatus, InventoryItem, InventoryStatus, Season } from '../types';

// Date utilities
export function parseDate(s: string): Date {
  const [year, month, day] = s.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(s: string): string {
  if (!s) return '—';
  const d = parseDate(s);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtRange(a: string, b: string): string {
  if (!a && !b) return 'No dates set';
  if (a === b || !b) return fmtDate(a);
  const d1 = parseDate(a);
  const d2 = parseDate(b);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()) {
    return `${months[d1.getMonth()]} ${d1.getDate()}–${d2.getDate()}, ${d1.getFullYear()}`;
  }
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}

export function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = parseDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

// Status derivation (BUILD-NOTES §4.2)
export function derivedStatus(n: Node): PhaseStatus {
  if (!n.start || !n.end) return n.status;
  const today = todayISO();
  if (today < n.start) return 'upcoming';
  if (today > n.end) return 'done';
  return 'active';
}

export function syncStatuses(nodes: Node[]): void {
  nodes.forEach(n => {
    if (n.start && n.end) {
      n.status = derivedStatus(n);
    }
    if (n.branches) {
      n.branches.forEach(b => syncStatuses(b.nodes));
    }
  });
}

// A season may only be completed after its calendar year has ended and all
// dated activity is in the past. Undated phases are treated as unfinished.
export function getSeasonCompletionBlockReason(season: Season, now = new Date()): string | null {
  const seasonYear = Number.parseInt(season.title, 10);
  if (Number.isFinite(seasonYear) && now.getFullYear() <= seasonYear) {
    return `Season ${season.title} cannot be archived until ${seasonYear + 1}.`;
  }

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let reason: string | null = null;
  walkNodes(season.root, (node) => {
    if (reason) return;
    if (!node.end || node.end >= today) {
      reason = node.end
        ? `Phase “${node.name}” is active or scheduled for today/future.`
        : `Phase “${node.name}” has no completed end date.`;
      return;
    }
    const upcomingEvent = node.events.find((event) => !event.date || event.date >= today);
    if (upcomingEvent) {
      reason = upcomingEvent.date
        ? `Check “${upcomingEvent.name}” is scheduled for today/future.`
        : `Check “${upcomingEvent.name}” has no completed date.`;
    }
  });
  return reason;
}

// Inventory status
export function invStatus(item: InventoryItem): InventoryStatus {
  if (item.haveQty <= 0) return 'need';
  if (item.haveQty < item.neededQty) return 'partial';
  return 'have';
}

// ID generation. IDs are persisted in Firestore and may be created by multiple
// tabs/users, so a process-local counter is not sufficient.
let uidCounter = 1;

function fallbackRandomId(): string {
  // Older Web Crypto implementations may not expose randomUUID yet, but do
  // expose getRandomValues. Only non-crypto test/runtime environments use the
  // timestamp/counter fallback.
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  const timestamp = Date.now().toString(36);
  const counter = (uidCounter++).toString(36);
  return `${timestamp}-${counter}`;
}

export function uid(prefix: string): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}_${randomUuid || fallbackRandomId()}`;
}

export function setUidCounter(n: number): void {
  uidCounter = n;
}

// Tree traversal helpers
export function walkNodes(nodes: Node[], fn: (n: Node) => void): void {
  nodes.forEach(n => {
    fn(n);
    if (n.branches) {
      n.branches.forEach(b => walkNodes(b.nodes, fn));
    }
  });
}

export function findNodeById(nodes: Node[], id: string): Node | null {
  let found: Node | null = null;
  walkNodes(nodes, n => {
    if (n.id === id) found = n;
  });
  return found;
}

// Image compression helper
export function readAndCompress(
  file: File,
  maxW: number,
  quality: number,
  cb: (dataUrl: string | null) => void
): void {
  if (!file || !file.type.startsWith('image/')) {
    cb(null);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        try {
          cb(canvas.toDataURL('image/jpeg', quality));
        } catch {
          cb(null);
        }
      } else {
        cb(null);
      }
    };
    img.onerror = () => cb(null);
    img.src = e.target?.result as string;
  };
  reader.onerror = () => cb(null);
  reader.readAsDataURL(file);
}

// Color utilities for tree/branch rendering
export const PALETTE = [
  'var(--red-wine)',
  'var(--white-wine)',
  'var(--grape)',
  'var(--vine)',
  'var(--barrel)',
  'var(--burgundy)',
];

export const TRUNK_COLOR = 'var(--barrel)';

const SHADE_MIXES = [
  { pct: 74, tone: 'var(--surface)' },
  { pct: 66, tone: 'var(--ink)' },
  { pct: 58, tone: 'var(--surface)' },
  { pct: 82, tone: 'var(--ink)' },
];

export function shadeColor(base: string, idx: number): string {
  const m = SHADE_MIXES[idx % SHADE_MIXES.length];
  return `color-mix(in srgb, ${base} ${m.pct}%, ${m.tone})`;
}

export function branchColor(parentColor: string, idx: number): string {
  return parentColor === TRUNK_COLOR
    ? PALETTE[idx % PALETTE.length]
    : shadeColor(parentColor, idx);
}

// Default winemaking phases for a season. The target year is explicit so
// creating an older/newer season never silently uses the wall-clock year.
export function createDefaultPhases(seasonYear = new Date().getFullYear()): Node[] {
  const currentYear = seasonYear;
  const nextYear = seasonYear + 1;

  const phases: Array<{
    name: string;
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    year: number;
  }> = [
    { name: 'Growing Season', startMonth: 4, startDay: 1, endMonth: 9, endDay: 30, year: currentYear },
    { name: 'Harvest', startMonth: 10, startDay: 1, endMonth: 10, endDay: 15, year: currentYear },
    { name: 'Primary Fermentation', startMonth: 10, startDay: 16, endMonth: 11, endDay: 15, year: currentYear },
    { name: 'Secondary Fermentation', startMonth: 11, startDay: 16, endMonth: 12, endDay: 31, year: currentYear },
    { name: 'Racking', startMonth: 1, startDay: 1, endMonth: 1, endDay: 31, year: nextYear },
    { name: 'Aging', startMonth: 2, startDay: 1, endMonth: 8, endDay: 31, year: nextYear },
    { name: 'Bottling', startMonth: 9, startDay: 1, endMonth: 9, endDay: 30, year: nextYear },
  ];

  return phases.map((p, idx) => ({
    id: uid('n'),
    name: p.name,
    start: `${p.year}-${String(p.startMonth).padStart(2, '0')}-${String(p.startDay).padStart(2, '0')}`,
    end: `${p.year}-${String(p.endMonth).padStart(2, '0')}-${String(p.endDay).padStart(2, '0')}`,
    status: 'upcoming' as PhaseStatus,
    notes: [],
    events: [],
    invIds: [],
    libIds: [],
    branches: null,
  }));
}

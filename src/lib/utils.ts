import type { Node, PhaseStatus, InventoryItem, InventoryStatus } from '../types';

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

// Inventory status
export function invStatus(item: InventoryItem): InventoryStatus {
  if (item.haveQty <= 0) return 'need';
  if (item.haveQty < item.neededQty) return 'partial';
  return 'have';
}

// ID generation
let uidCounter = 1;
export function uid(prefix: string): string {
  return `${prefix}${uidCounter++}`;
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

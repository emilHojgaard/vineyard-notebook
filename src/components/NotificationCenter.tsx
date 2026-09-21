import { useEffect, useState } from 'react';
import type { NotificationKind } from '../lib/notifications';

interface Notice { id: number; message: string; kind: NotificationKind; }
let nextId = 1;

export function NotificationCenter() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; kind: NotificationKind }>).detail;
      const id = nextId++;
      setNotices(current => [...current, { id, ...detail }]);
      window.setTimeout(() => setNotices(current => current.filter(notice => notice.id !== id)), 5000);
    };
    window.addEventListener('vineyard-notification', handle);
    return () => window.removeEventListener('vineyard-notification', handle);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[90] space-y-2" aria-live="polite">
      {notices.map(notice => (
        <div key={notice.id} role="status" className={`max-w-sm rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${notice.kind === 'error' ? 'bg-status-need' : notice.kind === 'success' ? 'bg-status-have' : 'bg-burgundy'}`}>
          {notice.message}
        </div>
      ))}
    </div>
  );
}

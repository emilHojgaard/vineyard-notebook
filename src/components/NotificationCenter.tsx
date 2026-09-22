import { useEffect, useState } from 'react';
import type { NotificationAction, NotificationKind } from '../lib/notifications';

interface Notice { id: number; message: string; kind: NotificationKind; action?: NotificationAction; }
let nextId = 1;

export function NotificationCenter() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; kind: NotificationKind; action?: NotificationAction }>).detail;
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
          <div className="flex items-center gap-3">
            <span>{notice.message}</span>
            {notice.action && (
              <button
                type="button"
                className="shrink-0 underline underline-offset-2"
                onClick={() => {
                  setNotices(current => current.filter(item => item.id !== notice.id));
                  void notice.action?.onClick();
                }}
              >
                {notice.action.label}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

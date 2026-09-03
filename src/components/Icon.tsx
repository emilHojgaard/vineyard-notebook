const icons = {
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><line x1="3.5" y1="10" x2="20.5" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  timeline: '<circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="6" x2="20" y2="6"/><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="12" x2="20" y2="12"/><circle cx="5" cy="18" r="1.5" fill="currentColor" stroke="none"/><line x1="9" y1="18" x2="20" y2="18"/>',
  crate: '<path d="M3.5 8.3 12 4l8.5 4.3L12 12.6 3.5 8.3z"/><path d="M3.5 8.3v7.7L12 20l8.5-4V8.3"/><path d="M12 12.6V20"/>',
  book: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13z"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M4 17l5-5 3.3 3.3L16 12l4 4"/>',
  filetext: '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><line x1="8.5" y1="12.3" x2="15.5" y2="12.3"/><line x1="8.5" y1="15.8" x2="15.5" y2="15.8"/>',
  play: '<circle cx="12" cy="12" r="8.3"/><path d="M10 9.2l5 2.8-5 2.8V9.2z" fill="currentColor" stroke="none"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  chevronLeft: '<polyline points="14.5 5 8 12 14.5 19"/>',
  chevronRight: '<polyline points="9.5 5 16 12 9.5 19"/>',
  chevronUp: '<polyline points="6 15 12 9 18 15"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  camera: '<path d="M4 8.3A1.5 1.5 0 0 1 5.5 6.8h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.3v9.2A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5V8.3z"/><circle cx="12" cy="13" r="3.2"/>',
  branch: '<path d="M12 4v6"/><path d="M12 10c0 3-3 3-5 5.4"/><path d="M12 10c0 3 3 3 5 5.4"/><circle cx="12" cy="4" r="1.7" fill="currentColor" stroke="none"/><circle cx="6.6" cy="17" r="1.7" fill="currentColor" stroke="none"/><circle cx="17.4" cy="17" r="1.7" fill="currentColor" stroke="none"/>',
  check: '<polyline points="4 12.5 9 17.5 20 5.5"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 12.5a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9L17 7"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.3a4 4 0 0 1 8 0v3.2"/>',
  unlock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.3a4 4 0 0 1 7.4-2.1"/>',
  alert: '<path d="M12 3.5 21 19.5H3L12 3.5z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6"/>',
  pencil: '<path d="M4 20l.9-4.2L16.2 4.5a1.5 1.5 0 0 1 2.1 0l1.2 1.2a1.5 1.5 0 0 1 0 2.1L8.2 19.1 4 20z"/><path d="M14.5 6.8l2.7 2.7"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  tree: '<path d="M12 4v6"/><path d="M12 10c0 3-3 3-5 5.4"/><path d="M12 10c0 3 3 3 5 5.4"/><circle cx="12" cy="4" r="1.7" fill="currentColor" stroke="none"/><circle cx="6.6" cy="17" r="1.7" fill="currentColor" stroke="none"/><circle cx="17.4" cy="17" r="1.7" fill="currentColor" stroke="none"/>',
};

interface IconProps {
  name: keyof typeof icons;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 17, className = '' }: IconProps) {
  const path = icons[name] || icons.dot;

  return (
    <svg
      className={`inline-block flex-shrink-0 ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

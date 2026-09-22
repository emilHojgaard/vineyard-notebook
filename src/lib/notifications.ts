export type NotificationKind = 'error' | 'success' | 'info';
export interface NotificationAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export function notify(message: string, kind: NotificationKind = 'info', action?: NotificationAction) {
  window.dispatchEvent(new CustomEvent('vineyard-notification', { detail: { message, kind, action } }));
}

export function notifyUndo(message: string, onUndo: () => void | Promise<void>) {
  notify(message, 'info', { label: 'Undo', onClick: onUndo });
}

export const notifyError = (message: string) => notify(message, 'error');
export const notifySuccess = (message: string) => notify(message, 'success');

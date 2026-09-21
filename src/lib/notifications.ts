export type NotificationKind = 'error' | 'success' | 'info';

export function notify(message: string, kind: NotificationKind = 'info') {
  window.dispatchEvent(new CustomEvent('vineyard-notification', { detail: { message, kind } }));
}

export const notifyError = (message: string) => notify(message, 'error');
export const notifySuccess = (message: string) => notify(message, 'success');

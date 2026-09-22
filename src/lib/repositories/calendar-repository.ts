import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface CalendarToken {
  id: string;
  createdAt: string | null;
}

export async function generateCalendarToken(projectId: string): Promise<string> {
  const callable = httpsCallable(functions, 'generateCalendarToken');
  const result = await callable({ projectId });
  return (result.data as { token: string }).token;
}

export async function revokeCalendarToken(token: string): Promise<void> {
  const callable = httpsCallable(functions, 'revokeCalendarToken');
  await callable({ token });
}

export async function listCalendarTokens(projectId: string): Promise<CalendarToken[]> {
  const callable = httpsCallable(functions, 'listCalendarTokens');
  const result = await callable({ projectId });
  return (result.data as { tokens: CalendarToken[] }).tokens;
}

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatInvitationError } from '../lib/auth-errors';
import { notifyError } from '../lib/notifications';
import { Icon } from './Icon';

type InvitationAction = 'accept' | 'decline';

/**
 * Invitations are deliberately an inbox-style panel rather than a modal.
 * Pending invitations stay in AuthContext when the panel is dismissed, so a
 * user can enter the app and make the decision when they are ready.
 */
export function InvitationPrompt() {
  const { pendingInvitations, acceptInvitation, declineInvitation } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [processing, setProcessing] = useState<Record<string, InvitationAction>>({});

  useEffect(() => {
    // Once the inbox is empty, show it automatically if a later invitation
    // arrives (including after auth restoration or an account switch).
    if (pendingInvitations.length === 0) setIsExpanded(true);
  }, [pendingInvitations.length]);

  const setProcessingAction = (invitationId: string, action: InvitationAction | null) => {
    setProcessing((current) => {
      if (action) return { ...current, [invitationId]: action };
      const next = { ...current };
      delete next[invitationId];
      return next;
    });
  };

  const handleAccept = async (invitationId: string) => {
    setProcessingAction(invitationId, 'accept');
    try {
      await acceptInvitation(invitationId);
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      notifyError(formatInvitationError(error));
    } finally {
      setProcessingAction(invitationId, null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessingAction(invitationId, 'decline');
    try {
      await declineInvitation(invitationId);
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      notifyError('Failed to decline invitation. Please try again.');
    } finally {
      setProcessingAction(invitationId, null);
    }
  };

  if (pendingInvitations.length === 0) return null;

  if (!isExpanded) {
    return (
      <button
        type="button"
        className="fixed top-4 right-4 z-[70] flex items-center gap-2 rounded-full bg-burgundy px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-burgundy-deep"
        onClick={() => setIsExpanded(true)}
        aria-expanded="false"
        aria-controls="pending-invitations"
      >
        <Icon name="user" size={16} />
        Invitations ({pendingInvitations.length})
      </button>
    );
  }

  return (
    <aside
      id="pending-invitations"
      className="fixed top-4 right-4 z-[70] w-[calc(100vw-2rem)] max-w-sm max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl bg-parchment shadow-2xl border border-border"
      aria-labelledby="invitations-title"
      aria-live="polite"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-parchment p-4 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-burgundy/10 flex items-center justify-center flex-shrink-0">
            <Icon name="user" size={20} color="var(--burgundy)" />
          </div>
          <div>
            <h3 id="invitations-title" className="text-lg font-bold text-ink">Project Invitations</h3>
            <p className="text-xs text-ink-soft">
              You have {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="rounded-md p-1 text-ink-soft hover:bg-surface-2 hover:text-ink"
          aria-label="Dismiss invitations until later"
          title="Decide later"
        >
          ×
        </button>
      </div>

      <div className="p-4 space-y-3">
        {pendingInvitations.map((invitation) => {
          const action = processing[invitation.id];
          return (
            <div key={invitation.id} className="bg-surface border border-border rounded-lg p-4">
              <div className="mb-3">
                <div className="font-semibold text-ink mb-1">{invitation.projectName}</div>
                <div className="text-sm text-ink-soft">
                  You've been invited to collaborate on this project
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAccept(invitation.id)}
                  disabled={Boolean(action)}
                  className="flex-1 px-4 py-2 bg-burgundy text-white rounded-lg text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {action === 'accept' ? 'Accepting...' : 'Accept'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDecline(invitation.id)}
                  disabled={Boolean(action)}
                  className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-semibold text-ink hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {action === 'decline' ? 'Declining...' : 'Decline'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-parchment p-4 rounded-b-xl">
        <p className="text-xs text-ink-faint text-center">
          These invitations are for {pendingInvitations[0]?.email}. Dismiss this inbox to decide later.
        </p>
      </div>
    </aside>
  );
}

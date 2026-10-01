import { useEffect, useRef, useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [processing, setProcessing] = useState<Record<string, InvitationAction>>({});
  const inboxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isExpanded) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && inboxRef.current && !inboxRef.current.contains(target)) {
        setIsExpanded(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsExpanded(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isExpanded]);

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

  return (
    <div ref={inboxRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition-colors hover:bg-white/20"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        aria-controls="pending-invitations"
        aria-haspopup="dialog"
        aria-label={`Pending invitations: ${pendingInvitations.length}`}
        title={`${pendingInvitations.length} pending invitation${pendingInvitations.length === 1 ? '' : 's'}`}
      >
        <Icon name="user" size={16} />
        <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold leading-4 text-burgundy">
          {pendingInvitations.length > 9 ? '9+' : pendingInvitations.length}
        </span>
      </button>

      {isExpanded && (
        <aside
          id="pending-invitations"
          className="absolute right-0 top-full z-50 mt-2 max-h-[min(32rem,calc(100dvh-5rem))] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-border bg-parchment text-left shadow-2xl"
          aria-labelledby="invitations-title"
          aria-live="polite"
          role="dialog"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setIsExpanded(false);
              triggerRef.current?.focus();
            }
          }}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-xl border-b border-border bg-parchment p-3">
            <div>
              <h3 id="invitations-title" className="text-base font-bold text-ink">Project Invitations</h3>
              <p className="text-xs text-ink-soft">
                {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="rounded-md p-1 text-lg leading-none text-ink-soft hover:bg-surface-2 hover:text-ink"
              aria-label="Dismiss invitations until later"
              title="Decide later"
            >
              ×
            </button>
          </div>

          <div className="space-y-2 p-3">
            {pendingInvitations.map((invitation) => {
              const action = processing[invitation.id];
              return (
                <div key={invitation.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="mb-3">
                    <div className="mb-1 font-semibold text-ink">{invitation.projectName}</div>
                    <div className="text-xs text-ink-soft">
                      You've been invited to collaborate on this project.
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAccept(invitation.id)}
                      disabled={Boolean(action)}
                      className="flex-1 rounded-lg bg-burgundy px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-burgundy-deep disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {action === 'accept' ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecline(invitation.id)}
                      disabled={Boolean(action)}
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {action === 'decline' ? 'Declining...' : 'Decline'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-b-xl border-t border-border bg-parchment p-3">
            <p className="text-center text-xs text-ink-faint">
              Decide now or dismiss this inbox to come back later.
            </p>
          </div>
        </aside>
      )}
    </div>
  );
}

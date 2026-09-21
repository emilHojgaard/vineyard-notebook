import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from './Icon';
import { useModalKeyboard } from './useModalKeyboard';

export function InvitationPrompt() {
  const { pendingInvitations, acceptInvitation, declineInvitation } = useAuth();
  const [processing, setProcessing] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const keyboard = useModalKeyboard(pendingInvitations.length > 0, () => {}, modalRef);

  if (pendingInvitations.length === 0) {
    return null;
  }

  const handleAccept = async (invitationId: string) => {
    setProcessing(invitationId);
    try {
      await acceptInvitation(invitationId);
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      alert('Failed to accept invitation. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessing(invitationId);
    try {
      await declineInvitation(invitationId);
    } catch (error) {
      console.error('Failed to decline invitation:', error);
      alert('Failed to decline invitation. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="invitations-title" onKeyDown={keyboard.onKeyDown} className="bg-parchment rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-parchment border-b border-border p-4 rounded-t-xl">
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
        </div>

        <div className="p-4 space-y-3">
          {pendingInvitations.map((invitation) => (
            <div
              key={invitation.id}
              className="bg-surface border border-border rounded-lg p-4"
            >
              <div className="mb-3">
                <div className="font-semibold text-ink mb-1">
                  {invitation.projectName}
                </div>
                <div className="text-sm text-ink-soft">
                  You've been invited to collaborate on this project
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(invitation.id)}
                  disabled={processing === invitation.id}
                  className="flex-1 px-4 py-2 bg-burgundy text-white rounded-lg text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing === invitation.id ? 'Accepting...' : 'Accept'}
                </button>
                <button
                  onClick={() => handleDecline(invitation.id)}
                  disabled={processing === invitation.id}
                  className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-sm font-semibold text-ink hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing === invitation.id ? 'Declining...' : 'Decline'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-parchment border-t border-border p-4 rounded-b-xl">
          <p className="text-xs text-ink-faint text-center">
            These invitations are for {pendingInvitations[0]?.email}
          </p>
        </div>
      </div>
    </div>
  );
}

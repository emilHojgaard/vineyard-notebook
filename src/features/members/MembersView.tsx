import React, { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import type { Member } from '../../types';
import { notifyError } from '../../lib/notifications';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';

export function MembersView() {
  const { currentProject, members, inviteMember, removeMember, promoteMemberToOwner, pendingInvitations, cancelInvitation } = useData();
  const { currentUser } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteState, setInviteState] = useState<SaveState>('idle');
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmCancelInvite, setConfirmCancelInvite] = useState<string | null>(null);

  if (!currentProject) {
    return (
      <div className="p-4 text-center text-ink-soft">
        No project selected
      </div>
    );
  }

  const isOwner = currentProject.createdBy === currentUser?.uid;
  const canManageMembers = isOwner; // Could be extended to allow all members

  const handleInvite = async () => {
    setInviteError('');
    
    if (!inviteEmail.trim()) {
      setInviteError('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }

    // Check if already a member
    if (members.some(m => m.email.toLowerCase() === inviteEmail.toLowerCase())) {
      setInviteError('This user is already a member');
      return;
    }

    // Check if already invited
    if (pendingInvitations?.some(inv => inv.email.toLowerCase() === inviteEmail.toLowerCase())) {
      setInviteError('This user has already been invited');
      return;
    }

    setInviteState('saving');
    try {
      await inviteMember(inviteEmail.trim());
      setInviteState('saved');
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (error: unknown) {
      setInviteState('failed');
      setInviteError(error instanceof Error ? error.message : 'Failed to send invitation');
    }
  };

  const handlePromote = async (member: Member) => {
    if (!canManageMembers || member.role === 'owner') return;
    if (!window.confirm(`Promote ${member.displayName} to owner? Owners can manage project membership.`)) return;
    try {
      await promoteMemberToOwner(member.id);
    } catch (error) {
      console.error('Failed to promote member:', error);
      notifyError('Failed to promote member. Please try again.');
    }
  };

  const handleRemove = async (member: Member) => {
    if (!canManageMembers) return;
    
    try {
      await removeMember(member.id);
      setConfirmRemove(null);
    } catch (error) {
      console.error('Failed to remove member:', error);
      notifyError('Failed to remove member. Please try again.');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(invitationId);
      setConfirmCancelInvite(null);
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      notifyError('Failed to cancel invitation. Please try again.');
    }
  };

  const canRemoveMember = (member: Member) => {
    // Cannot remove yourself if you're the last member
    if (member.id === currentUser?.uid && members.length === 1) {
      return false;
    }
    // Only owner can remove members
    return canManageMembers;
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-burgundy">Project Members</h2>
        {canManageMembers && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-3 py-1.5 bg-burgundy text-white rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-burgundy-dark transition-colors"
          >
            <Icon name="plus" size={14} />
            Invite
          </button>
        )}
      </div>

      {/* Current Members */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden mb-4">
        <div className="bg-burgundy text-white px-3 py-2">
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Current Members ({members.length})
          </h3>
        </div>
        <div className="divide-y divide-border">
          {members.map((member) => (
            <div
              key={member.id}
              className="px-3 py-3 flex items-center justify-between hover:bg-surface-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-ink truncate">
                    {member.displayName}
                  </div>
                  {member.role === 'owner' && (
                    <span className="px-2 py-0.5 bg-burgundy text-white text-xs rounded-full font-semibold">
                      Owner
                    </span>
                  )}
                  {member.id === currentUser?.uid && (
                    <span className="text-xs text-ink-soft">(You)</span>
                  )}
                </div>
                <div className="text-xs text-ink-soft truncate">
                  {member.email}
                </div>
              </div>
              <div className="ml-2 flex items-center gap-1">
                {canManageMembers && member.role !== 'owner' && (
                  <button
                    onClick={() => handlePromote(member)}
                    className="px-2 py-1 text-xs text-burgundy hover:bg-burgundy hover:text-white rounded transition-colors"
                    title="Promote to owner"
                  >
                    Make owner
                  </button>
                )}
                {canRemoveMember(member) && (
                  <button
                    onClick={() => setConfirmRemove(member)}
                    className="p-1.5 text-status-need hover:bg-status-need hover:text-white rounded transition-colors"
                    title="Remove member"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invitations */}
      {canManageMembers && pendingInvitations && pendingInvitations.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="bg-gold text-cellar px-3 py-2">
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Pending Invitations ({pendingInvitations.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation.id}
                className="px-3 py-3 flex items-center justify-between hover:bg-surface-2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">
                    {invitation.email}
                  </div>
                  <div className="text-xs text-ink-soft">
                    Invited {new Date(invitation.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => setConfirmCancelInvite(invitation.id)}
                  className="ml-2 p-1.5 text-ink-soft hover:bg-surface-2 hover:text-ink rounded transition-colors"
                  title="Cancel invitation"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteEmail('');
          setInviteError('');
        }}
        title="Invite Member"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-ink-faint mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                setInviteError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInvite();
                }
              }}
              placeholder="colleague@example.com"
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink"
              autoFocus
            />
            <SaveStatus state={inviteState} error={inviteError} className="mt-2 block" />
            {inviteError && inviteState !== 'failed' && (
              <div className="mt-2 text-sm text-status-need">
                {inviteError}
              </div>
            )}
          </div>

          <div className="text-xs text-ink-soft bg-surface border border-border rounded-lg p-3">
            <p className="mb-2">
              <strong>Note:</strong> The invited user will receive access to this project
              when they log in with this email address.
            </p>
            <p>
              If they don't have an account yet, they'll need to sign up first.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteError('');
              }}
              className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-ink font-semibold hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInvite}
              disabled={inviteState === 'saving'}
              className="flex-1 px-4 py-2 bg-burgundy text-white rounded-lg font-semibold hover:bg-burgundy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inviteState === 'saving' ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Remove Member Confirmation */}
      {confirmRemove && (
        <ConfirmDialog
          isOpen={true}
          title="Remove Member"
          message={`Are you sure you want to remove ${confirmRemove.displayName} from this project? They will lose access to all project data.`}
          confirmText="Remove"
          onConfirm={() => handleRemove(confirmRemove)}
          onCancel={() => setConfirmRemove(null)}
          isDanger={true}
        />
      )}

      {/* Cancel Invitation Confirmation */}
      {confirmCancelInvite && (
        <ConfirmDialog
          isOpen={true}
          title="Cancel Invitation"
          message="Are you sure you want to cancel this invitation?"
          confirmText="Cancel Invitation"
          onConfirm={() => handleCancelInvitation(confirmCancelInvite)}
          onCancel={() => setConfirmCancelInvite(null)}
          isDanger={false}
        />
      )}
    </div>
  );
}

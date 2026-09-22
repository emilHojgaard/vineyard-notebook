import { useState, useRef } from 'react';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import type { Node, Branch, Note, Event } from '../../types';
import { fmtDate, todayISO, derivedStatus, uid, daysUntil } from '../../lib/utils';
import { uploadPhasePhoto } from '../../lib/repositories/media-repository';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';

interface PhaseModalProps {
  node: Node;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => Promise<void>;
  onDelete?: () => void;
  isLocked: boolean;
  isArchived: boolean;
  accent?: string;
}

export function PhaseModal({
  node,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  isLocked,
  isArchived,
  accent,
}: PhaseModalProps) {
  const { currentUser } = useAuth();
  const { currentProject, appState } = useData();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const ro = isLocked;
  const roEdit = isArchived;
  const roNotes = isArchived;

  const hasDates = !!(node.start && node.end);
  const currentStatus = hasDates ? derivedStatus(node) : node.status;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (dataUrl: string): Promise<string | null> => {
    if (!currentProject) return null;

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const filename = `${uid('photo')}.jpg`;
      return await uploadPhasePhoto(currentProject.id, filename, blob);
    } catch (error) {
      console.error('Photo upload failed:', error);
      throw new Error('Photo upload failed. Please try again.');
    }
  };

  const persistChanges = async () => {
    setSaveState('saving');
    setSaveError(null);
    try {
      await onUpdate();
      setSaveState('saved');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save. Please try again.';
      setSaveError(message);
      setSaveState('failed');
      return false;
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() && !photoPreview) return;

    setUploading(true);
    try {
      let photoUrl: string | undefined;
      if (photoPreview) photoUrl = (await uploadPhoto(photoPreview)) || undefined;

      const newNote: Note = {
        id: uid('note'),
        author: currentUser?.displayName || 'Unknown',
        text: noteText.trim(),
        date: todayISO(),
        photo: photoUrl,
      };

      node.notes.push(newNote);
      if (await persistChanges()) {
        setNoteText('');
        setPhotoPreview(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
      } else {
        node.notes.pop();
      }
    } catch (error) {
      setSaveState('failed');
      setSaveError(error instanceof Error ? error.message : 'Failed to save. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const idx = node.notes.findIndex((n) => n.id === noteId);
    if (idx !== -1) {
      const [removed] = node.notes.splice(idx, 1);
      if (await persistChanges()) setConfirmDeleteNote(null);
      else node.notes.splice(idx, 0, removed);
    } else {
      setConfirmDeleteNote(null);
    }
  };

  const handleAddEvent = async () => {
    if (!eventName.trim() || !eventDate) return;

    const newEvent: Event = {
      id: uid('event'),
      name: eventName.trim(),
      date: eventDate,
    };

    node.events.push(newEvent);
    if (await persistChanges()) {
      setEventName('');
      setEventDate('');
    } else {
      node.events.pop();
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    const idx = node.events.findIndex((e) => e.id === eventId);
    if (idx !== -1) {
      const [removed] = node.events.splice(idx, 1);
      if (await persistChanges()) setConfirmDeleteEvent(null);
      else node.events.splice(idx, 0, removed);
    } else {
      setConfirmDeleteEvent(null);
    }
  };

  const handleStatusChange = async (status: 'upcoming' | 'active' | 'done') => {
    const previousStatus = node.status;
    node.status = status;
    if (!await persistChanges()) node.status = previousStatus;
  };

  const sortedEvents = [...node.events].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`${node.branches ? 'Split Point' : 'Phase'}: ${node.name}`}>
        <SaveStatus state={saveState} error={saveError} className="mb-3 block" />
        {/* Title */}
        {roEdit ? (
          <div className="text-lg font-semibold text-ink mb-2">{node.name}</div>
        ) : (
          <input
            type="text"
            value={node.name}
            onChange={(e) => {
              node.name = e.target.value || 'Untitled phase';
              void persistChanges();
            }}
            className="w-full px-3 py-2 text-lg font-semibold border border-border rounded-md bg-surface text-ink mb-2"
          />
        )}

        {/* Dates */}
        {roEdit ? (
          <div className="text-sm text-ink-soft mb-4">
            {node.start || node.end ? `${fmtDate(node.start)} – ${fmtDate(node.end)}` : 'No dates set'}
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="date"
              value={node.start}
              onChange={(e) => {
                node.start = e.target.value;
                void persistChanges();
              }}
              className="flex-1 px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
            />
            <span className="text-ink-soft">→</span>
            <input
              type="date"
              value={node.end}
              onChange={(e) => {
                node.end = e.target.value;
                void persistChanges();
              }}
              className="flex-1 px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
            />
          </div>
        )}

        {/* Status */}
        <div className="mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
            Status
          </h4>
          {!roEdit && !hasDates ? (
            <div className="flex gap-2">
              {(['upcoming', 'active', 'done'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md border transition-colors ${
                    currentStatus === status
                      ? 'bg-surface-2 border-border text-st-' + status
                      : 'bg-surface border-transparent text-ink-soft hover:border-border'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm font-semibold" style={{ color: `var(--st-${currentStatus})` }}>
              {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
              {hasDates && (
                <span className="text-xs text-ink-faint font-normal ml-2">
                  — set automatically from the dates
                </span>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
            Notes
          </h4>
          {node.notes.length === 0 ? (
            <div className="text-sm text-ink-faint italic py-2">No notes yet.</div>
          ) : (
            <div className="space-y-2 mb-3">
              {node.notes.map((note) => (
                <div key={note.id} className="bg-surface border border-border rounded-md p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-ink-faint">
                      {fmtDate(note.date)} • {note.author}
                    </div>
                    {!roNotes && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteNote(note.id)}
                        aria-label={`Delete note from ${fmtDate(note.date)}`}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                  {note.text && <div className="text-sm text-ink leading-relaxed">{note.text}</div>}
                  {note.photo && (
                    <img
                      src={note.photo}
                      alt="Note attachment"
                      className="mt-2 rounded-md max-w-full cursor-pointer"
                      onClick={() => window.open(note.photo, '_blank')}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {!roNotes && (
            <div className="space-y-2">
              {photoPreview && (
                <div className="relative inline-block">
                  <img src={photoPreview} alt="Preview" className="rounded-md max-w-full max-h-48" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }}
                    aria-label="Remove photo preview"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-cellar/60 text-white flex items-center justify-center hover:bg-cellar/80"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add an observation…"
                  className="flex-1 px-3 py-2 border border-border rounded-md bg-surface-2 text-ink text-sm resize-none"
                  rows={2}
                />
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  aria-label="Add photo to note"
                  className="w-10 h-10 flex items-center justify-center border border-border rounded-md bg-surface text-ink-soft hover:text-burgundy hover:border-burgundy transition-colors"
                >
                  <Icon name="camera" size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleAddNote}
                  aria-label="Add note"
                  disabled={uploading || (!noteText.trim() && !photoPreview)}
                  className="w-10 h-10 flex items-center justify-center rounded-md bg-burgundy text-white hover:bg-burgundy-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? '...' : <Icon name="plus" size={18} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Events/Checks */}
        <div className="mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
            Checks &amp; Events
          </h4>
          {sortedEvents.length === 0 ? (
            <div className="text-sm text-ink-faint italic py-2">No checks or events yet.</div>
          ) : (
            <div className="space-y-2 mb-3">
              {sortedEvents.map((event) => {
                const daysLeft = daysUntil(event.date);
                const isSoon = node.status !== 'done' && daysLeft !== null && daysLeft <= appState.eventAlertDays;
                return (
                  <div
                    key={event.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border ${
                      isSoon
                        ? 'bg-status-need/10 border-status-need/30'
                        : 'bg-surface border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xs text-ink-soft font-mono">{fmtDate(event.date)}</span>
                      <span className="text-sm text-ink font-medium">{event.name}</span>
                    </div>
                    {!roNotes && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEvent(event.id)}
                        aria-label={`Delete check ${event.name}`}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!roNotes && (
            <div className="flex gap-2">
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. pH check"
                className="flex-1 px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
              />
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
              />
              <button
                type="button"
                onClick={handleAddEvent}
                aria-label="Add check"
                disabled={!eventName.trim() || !eventDate}
                className="w-10 h-10 flex items-center justify-center rounded-md bg-burgundy text-white hover:bg-burgundy-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Branches */}
        {node.branches && (
          <div className="mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
              Branches
            </h4>
            <div className="space-y-2">
              {node.branches.map((branch) => (
                <div
                  key={branch.id}
                  className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-md"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: accent || 'var(--barrel)' }}
                  />
                  <span className="flex-1 text-sm font-semibold text-ink">{branch.name}</span>
                  <span className="text-xs text-ink-soft">
                    {branch.nodes.length} phase{branch.nodes.length !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete Button */}
        {!ro && onDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full mt-4 px-4 py-2 text-sm font-semibold text-status-need hover:bg-status-need/10 rounded-md transition-colors"
          >
            Delete this phase
          </button>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Phase"
        message="Are you sure you want to delete this phase? This can't be undone."
        confirmText="Delete"
        onConfirm={() => {
          onDelete?.();
          setConfirmDelete(false);
          onClose();
        }}
        onCancel={() => setConfirmDelete(false)}
        isDanger
      />

      <ConfirmDialog
        isOpen={confirmDeleteNote !== null}
        title="Delete Note"
        message="Are you sure you want to delete this note? This can't be undone."
        confirmText="Delete"
        onConfirm={() => confirmDeleteNote && handleDeleteNote(confirmDeleteNote)}
        onCancel={() => setConfirmDeleteNote(null)}
        isDanger
      />

      <ConfirmDialog
        isOpen={confirmDeleteEvent !== null}
        title="Delete Event"
        message="Are you sure you want to delete this check? This can't be undone."
        confirmText="Delete"
        onConfirm={() => confirmDeleteEvent && handleDeleteEvent(confirmDeleteEvent)}
        onCancel={() => setConfirmDeleteEvent(null)}
        isDanger
      />
    </>
  );
}

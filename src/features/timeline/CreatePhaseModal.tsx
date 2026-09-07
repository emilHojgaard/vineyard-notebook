import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icon';

interface CreatePhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, start?: string, end?: string) => void;
}

export function CreatePhaseModal({ isOpen, onClose, onCreate }: CreatePhaseModalProps) {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), start || undefined, end || undefined);
    // Reset form
    setName('');
    setStart('');
    setEnd('');
  };

  const handleCancel = () => {
    setName('');
    setStart('');
    setEnd('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Create Phase" maxWidth="400px">
      <div className="space-y-4">
        {/* Phase name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
            Phase Name <span className="text-status-need">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="e.g. Harvest & Crush"
            autoFocus
            className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
          />
        </div>

        {/* Start date */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
            Start Date <span className="text-ink-soft text-[10px] font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
          />
        </div>

        {/* End date */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
            End Date <span className="text-ink-soft text-[10px] font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2.5 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Icon name="plus" size={14} />
            Create Phase
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2.5 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

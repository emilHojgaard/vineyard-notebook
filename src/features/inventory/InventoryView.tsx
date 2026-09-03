import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import type { InventoryItem, InventorySection } from '../../types';
import { invStatus, uid } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function InventoryView() {
  const { inventory, appState, updateInventory } = useData();
  const inv = inventory[appState.year];

  const [addingSectionName, setAddingSectionName] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [editingItem, setEditingItem] = useState<{ sectionId: string; item: InventoryItem } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'section' | 'item'; id: string; sectionId?: string } | null>(null);

  const isArchived = false; // Inventory not year-locked in mockup

  if (!inv) {
    return (
      <div className="p-4 text-center text-ink-soft">
        <p>No inventory data for {appState.year}</p>
      </div>
    );
  }

  const handleAddSection = () => {
    if (!addingSectionName.trim()) return;

    const newSection: InventorySection = {
      id: uid('sec'),
      name: addingSectionName.trim(),
      items: [],
    };

    const updatedInv = JSON.parse(JSON.stringify(inv));
    updatedInv.sections.push(newSection);
    setAddingSectionName('');
    setAddingSection(false);
    updateInventory(appState.year, updatedInv);
  };

  const handleDeleteSection = (sectionId: string) => {
    const updatedInv = JSON.parse(JSON.stringify(inv));
    updatedInv.sections = updatedInv.sections.filter((s) => s.id !== sectionId);
    updateInventory(appState.year, updatedInv);
    setConfirmDelete(null);
  };

  const handleAddItem = (sectionId: string) => {
    const updatedInv = JSON.parse(JSON.stringify(inv));
    const section = updatedInv.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const newItem: InventoryItem = {
      id: uid('inv'),
      name: 'New Item',
      haveQty: 0,
      neededQty: 1,
      unit: '',
      price: null,
    };

    section.items.push(newItem);
    setEditingItem({ sectionId, item: newItem });
    updateInventory(appState.year, updatedInv);
  };

  const handleUpdateItem = (sectionId: string, itemId: string, updates: Partial<InventoryItem>) => {
    const updatedInv = JSON.parse(JSON.stringify(inv));
    const section = updatedInv.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const item = section.items.find((i) => i.id === itemId);
    if (!item) return;

    Object.assign(item, updates);
    updateInventory(appState.year, updatedInv);
  };

  const handleDeleteItem = (sectionId: string, itemId: string) => {
    const updatedInv = JSON.parse(JSON.stringify(inv));
    const section = updatedInv.sections.find((s) => s.id === sectionId);
    if (!section) return;

    section.items = section.items.filter((i) => i.id !== itemId);
    updateInventory(appState.year, updatedInv);
    setConfirmDelete(null);
  };

  const statusColors = {
    need: 'var(--status-need)',
    partial: 'var(--status-partial)',
    have: 'var(--status-have)',
  };

  const statusLabels = {
    need: 'Need',
    partial: 'Partial',
    have: 'Have',
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-surface px-4 py-3 border-b border-border">
        <h2 className="text-lg font-bold text-ink text-center">Inventory</h2>
        <p className="text-xs text-center text-ink-soft mt-1">
          Equipment &amp; Supplies for {appState.year}
        </p>
      </div>

      <div className="p-4">
        {inv.sections.length === 0 && !addingSection ? (
          <div className="text-center py-8">
            <p className="text-ink-faint mb-3">No inventory sections yet</p>
            {!isArchived && (
              <button
                onClick={() => setAddingSection(true)}
                className="text-burgundy font-semibold hover:underline"
              >
                + Add first section
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {inv.sections.map((section) => (
              <div key={section.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-ink">{section.name}</h3>
                  {!isArchived && (
                    <button
                      onClick={() => setConfirmDelete({ type: 'section', id: section.id })}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>

                {section.items.length === 0 ? (
                  <div className="text-sm text-ink-faint italic py-2 mb-2">
                    No items in this section
                  </div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {section.items.map((item) => {
                      const status = invStatus(item);
                      const isEditing = editingItem?.item.id === item.id;

                      return (
                        <div
                          key={item.id}
                          className="bg-parchment border border-border rounded-md p-3"
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handleUpdateItem(section.id, item.id, { name: e.target.value })
                                }
                                className="w-full px-3 py-2 text-sm font-semibold border border-border rounded-md bg-surface text-ink"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-ink-faint uppercase tracking-wide block mb-1">
                                    Have
                                  </label>
                                  <input
                                    type="number"
                                    value={item.haveQty}
                                    onChange={(e) =>
                                      handleUpdateItem(section.id, item.id, {
                                        haveQty: Math.max(0, parseInt(e.target.value) || 0),
                                      })
                                    }
                                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink num"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-ink-faint uppercase tracking-wide block mb-1">
                                    Need
                                  </label>
                                  <input
                                    type="number"
                                    value={item.neededQty}
                                    onChange={(e) =>
                                      handleUpdateItem(section.id, item.id, {
                                        neededQty: Math.max(1, parseInt(e.target.value) || 1),
                                      })
                                    }
                                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink num"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-ink-faint uppercase tracking-wide block mb-1">
                                    Unit
                                  </label>
                                  <input
                                    type="text"
                                    value={item.unit}
                                    onChange={(e) =>
                                      handleUpdateItem(section.id, item.id, { unit: e.target.value })
                                    }
                                    placeholder="e.g. × 5L"
                                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-ink-faint uppercase tracking-wide block mb-1">
                                    Price
                                  </label>
                                  <input
                                    type="number"
                                    value={item.price ?? ''}
                                    onChange={(e) =>
                                      handleUpdateItem(section.id, item.id, {
                                        price: e.target.value ? parseFloat(e.target.value) : null,
                                      })
                                    }
                                    placeholder="0"
                                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink num"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="flex-1 px-3 py-2 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors"
                                >
                                  Done
                                </button>
                                <button
                                  onClick={() =>
                                    setConfirmDelete({ type: 'item', id: item.id, sectionId: section.id })
                                  }
                                  className="px-3 py-2 bg-surface border border-border text-status-need rounded-md text-sm font-semibold hover:bg-status-need/10 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => setEditingItem({ sectionId: section.id, item })}
                              className="cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-ink">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-ink-soft mt-1 num">
                                    {item.haveQty} / {item.neededQty}
                                    {item.unit && ` ${item.unit}`}
                                  </div>
                                  {item.price !== null && (
                                    <div className="text-xs text-ink-faint mt-1 num">
                                      ${item.price.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                                <div
                                  className="px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide"
                                  style={{
                                    backgroundColor: `color-mix(in srgb, ${statusColors[status]} 15%, transparent)`,
                                    color: statusColors[status],
                                  }}
                                >
                                  {statusLabels[status]}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isArchived && (
                  <button
                    onClick={() => handleAddItem(section.id)}
                    className="w-full px-3 py-2 border-2 border-dashed border-border rounded-md text-ink-faint font-semibold text-sm hover:text-ink-soft hover:border-barrel transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="plus" size={14} />
                    Add Item
                  </button>
                )}
              </div>
            ))}

            {/* Add section */}
            {!isArchived && (
              <>
                {addingSection ? (
                  <div className="bg-surface-2 border border-border rounded-lg p-4">
                    <input
                      type="text"
                      value={addingSectionName}
                      onChange={(e) => setAddingSectionName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                      placeholder="Section name (e.g. Equipment)"
                      autoFocus
                      className="w-full px-3 py-2 mb-3 border border-border rounded-md bg-surface text-ink text-sm font-semibold"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddSection}
                        disabled={!addingSectionName.trim()}
                        className="flex-1 px-3 py-2 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-40"
                      >
                        Add Section
                      </button>
                      <button
                        onClick={() => {
                          setAddingSection(false);
                          setAddingSectionName('');
                        }}
                        className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingSection(true)}
                    className="w-full px-4 py-3 border-2 border-dashed border-border rounded-lg text-ink-faint font-semibold text-sm hover:text-ink-soft hover:border-barrel transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="plus" size={14} />
                    Add Section
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmations */}
      <ConfirmDialog
        isOpen={confirmDelete?.type === 'section'}
        title="Delete Section"
        message="Delete this section and all its items? This can't be undone."
        confirmText="Delete"
        onConfirm={() => {
          if (confirmDelete?.type === 'section') {
            handleDeleteSection(confirmDelete.id);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
        isDanger
      />

      <ConfirmDialog
        isOpen={confirmDelete?.type === 'item'}
        title="Delete Item"
        message="Delete this item? This can't be undone."
        confirmText="Delete"
        onConfirm={() => {
          if (confirmDelete?.type === 'item' && confirmDelete.sectionId) {
            handleDeleteItem(confirmDelete.sectionId, confirmDelete.id);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
        isDanger
      />
    </div>
  );
}

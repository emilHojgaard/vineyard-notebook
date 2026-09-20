import { useEffect, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import type { InventoryItem, InventorySection, Node } from '../../types';
import { invStatus, uid, walkNodes } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  beginInventoryItemEdit,
  discardInventoryItemDraft,
  isInventoryItemEditing,
  type InventoryEditingState,
} from './inventoryEditing';

interface InventoryDraft extends InventoryItem {
  phaseIds: string[];
}

interface PhaseOption {
  id: string;
  name: string;
  branchPath: string[];
}

export function InventoryView() {
  const {
    inventory,
    appState,
    updateInventory,
    seasons,
    updateSeason,
    updateAppState,
    currentProject,
  } = useData();
  const inv = inventory[appState.year];
  const isEditMode = !appState.locked;
  const season = seasons[appState.year];

  const [addingSectionName, setAddingSectionName] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  // Only one item is rendered in edit mode, while drafts remain keyed by item ID.
  // This lets switching items preserve an unsaved draft without sharing edit state.
  const [editingState, setEditingState] = useState<InventoryEditingState<InventoryDraft>>({
    editingItemId: null,
    drafts: {},
  });
  const { drafts } = editingState;
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'section' | 'item'; id: string; sectionId?: string } | null>(null);

  const isArchived = false; // Inventory not year-locked in mockup
  const hasSeasons = Object.keys(seasons).length > 0;

  // Do not carry drafts or an edit target across seasons or projects. Inventory IDs
  // are only meaningful inside their current project's season data.
  useEffect(() => {
    setEditingState({ editingItemId: null, drafts: {} });
  }, [currentProject?.id, appState.year]);

  const phaseOptions: PhaseOption[] = [];
  const collectPhaseOptions = (nodes: Node[], branchPath: string[] = []) => {
    nodes.forEach((node) => {
      phaseOptions.push({ id: node.id, name: node.name, branchPath });
      if (node.branches) {
        node.branches.forEach((branch) =>
          collectPhaseOptions(branch.nodes, [...branchPath, branch.name])
        );
      }
    });
  };
  if (season) collectPhaseOptions(season.root);

  const phaseIdsForItem = (itemId: string): string[] => {
    if (!season) return [];
    const linked: string[] = [];
    walkNodes(season.root, (node) => {
      if ((node.invIds || []).includes(itemId)) linked.push(node.id);
    });
    return linked;
  };

  const startEditingItem = (item: InventoryItem) => {
    setEditingState((previous) =>
      beginInventoryItemEdit(previous, item.id, () => ({
        ...item,
        phaseIds: phaseIdsForItem(item.id),
      })),
    );
  };

  const updateDraft = (itemId: string, updates: Partial<InventoryDraft>) => {
    setEditingState((previous) => {
      const draft = previous.drafts[itemId];
      if (!draft) return previous;
      return {
        ...previous,
        drafts: { ...previous.drafts, [itemId]: { ...draft, ...updates } },
      };
    });
  };

  const handleCancelEdit = (itemId: string) => {
    setEditingState((previous) => discardInventoryItemDraft(previous, itemId));
  };

  const handleSaveItem = async (itemId: string) => {
    const draft = drafts[itemId];
    if (!draft) return;

    const updatedInv = JSON.parse(JSON.stringify(inv));
    const section = updatedInv.sections.find((s: InventorySection) =>
      s.items.some((item: InventoryItem) => item.id === itemId)
    );
    const item = section?.items.find((candidate: InventoryItem) => candidate.id === itemId);
    if (!item) return;

    const { phaseIds, ...itemFields } = draft;
    Object.assign(item, itemFields);
    const validPhaseIds = new Set(phaseOptions.map((phase) => phase.id));
    const selectedPhaseIds = phaseIds.filter((phaseId) => validPhaseIds.has(phaseId));

    // Inventory links are stored on the current season's tree, matching the
    // timeline/tree data model. Rebuild this item's references so deselection,
    // no links, and multiple links all persist without touching other items.
    const seasonUpdate = season ? JSON.parse(JSON.stringify(season)) : null;
    if (seasonUpdate) {
      walkNodes(seasonUpdate.root, (node) => {
        node.invIds = (node.invIds || []).filter((id) => id !== itemId);
        if (selectedPhaseIds.includes(node.id)) node.invIds.push(itemId);
      });
    }

    await updateInventory(appState.year, updatedInv);
    if (seasonUpdate) await updateSeason(appState.year, seasonUpdate);

    setEditingState((previous) => discardInventoryItemDraft(previous, itemId));
  };

  if (!hasSeasons) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-sm mx-auto">
          <div className="text-lg font-semibold text-ink mb-2">
            No Seasons Yet
          </div>
          <p className="text-sm text-ink-soft mb-4">
            Create your first season in the Timeline tab to start tracking inventory
          </p>
        </div>
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-sm mx-auto">
          <div className="text-lg font-semibold text-ink mb-2">
            No inventory for {appState.year}
          </div>
          <p className="text-sm text-ink-soft mb-4">
            Go to Timeline to create this season or select a different year
          </p>
          <button
            onClick={() => {
              const years = Object.keys(seasons).map(Number).sort((a, b) => b - a);
              if (years.length > 0) {
                updateAppState({ year: years[0] });
              }
            }}
            className="px-6 py-2 bg-burgundy text-white font-semibold rounded-lg hover:bg-burgundy-deep transition-colors"
          >
            Go to Latest Season
          </button>
        </div>
      </div>
    );
  }

  const handleAddSection = () => {
    if (!isEditMode || !addingSectionName.trim()) return;

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
    if (!isEditMode) return;

    const section = inv.sections.find((candidate) => candidate.id === sectionId);
    if (!section) return;

    const itemIds = new Set(section.items.map((item) => item.id));
    const updatedInv = JSON.parse(JSON.stringify(inv));
    updatedInv.sections = updatedInv.sections.filter((s: InventorySection) => s.id !== sectionId);
    updateInventory(appState.year, updatedInv);

    // A section deletion also removes its item references from phases.
    if (season && itemIds.size > 0) {
      const updatedSeason = JSON.parse(JSON.stringify(season));
      walkNodes(updatedSeason.root, (node) => {
        node.invIds = (node.invIds || []).filter((id) => !itemIds.has(id));
      });
      void updateSeason(appState.year, updatedSeason);
    }

    setEditingState((previous) => {
      const drafts = { ...previous.drafts };
      itemIds.forEach((itemId) => delete drafts[itemId]);
      return {
        editingItemId: previous.editingItemId && itemIds.has(previous.editingItemId)
          ? null
          : previous.editingItemId,
        drafts,
      };
    });
    setConfirmDelete(null);
  };

  const handleAddItem = (sectionId: string) => {
    if (!isEditMode) return;

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
    setEditingState((previous) =>
      beginInventoryItemEdit(previous, newItem.id, () => ({ ...newItem, phaseIds: [] })),
    );
    updateInventory(appState.year, updatedInv);
  };

  const handleDeleteItem = async (sectionId: string, itemId: string) => {
    if (!isEditMode) return;

    const updatedInv = JSON.parse(JSON.stringify(inv));
    const section = updatedInv.sections.find((s: InventorySection) => s.id === sectionId);
    if (!section) return;

    section.items = section.items.filter((item: InventoryItem) => item.id !== itemId);
    await updateInventory(appState.year, updatedInv);

    // Remove deleted item references from the current season as well, so a
    // later project/season switch can never expose a dangling cross-link.
    if (season) {
      const updatedSeason = JSON.parse(JSON.stringify(season));
      walkNodes(updatedSeason.root, (node) => {
        node.invIds = (node.invIds || []).filter((id) => id !== itemId);
      });
      await updateSeason(appState.year, updatedSeason);
    }

    setEditingState((previous) => discardInventoryItemDraft(previous, itemId));
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
            {!isArchived && isEditMode && (
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
                  {isEditMode && !isArchived && (
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
                      const isEditing = isInventoryItemEditing(editingState, item.id);
                      const draft = drafts[item.id] || {
                        ...item,
                        phaseIds: phaseIdsForItem(item.id),
                      };

                      return (
                        <div
                          key={item.id}
                          className={`relative bg-parchment border border-border rounded-md p-3 ${
                            isEditing ? 'z-10' : 'z-0'
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={draft.name}
                                onChange={(e) => updateDraft(item.id, { name: e.target.value })}
                                className="w-full px-3 py-2 text-sm font-semibold border border-border rounded-md bg-surface text-ink"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-ink-faint uppercase tracking-wide block mb-1">
                                    Have
                                  </label>
                                  <input
                                    type="number"
                                    value={draft.haveQty}
                                    onChange={(e) =>
                                      updateDraft(item.id, {
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
                                    value={draft.neededQty}
                                    onChange={(e) =>
                                      updateDraft(item.id, {
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
                                    value={draft.unit}
                                    onChange={(e) => updateDraft(item.id, { unit: e.target.value })}
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
                                    value={draft.price ?? ''}
                                    onChange={(e) =>
                                      updateDraft(item.id, {
                                        price: e.target.value ? parseFloat(e.target.value) : null,
                                      })
                                    }
                                    placeholder="0"
                                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-surface text-ink num"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-ink-faint uppercase tracking-wide block mb-1">
                                  Phases using this item
                                </label>
                                {phaseOptions.length === 0 ? (
                                  <p className="text-xs text-ink-faint italic">No phases in this season.</p>
                                ) : (
                                  <div className="max-h-40 overflow-y-auto border border-border rounded-md bg-surface p-2 space-y-1">
                                    {phaseOptions.map((phase) => (
                                      <label key={phase.id} className="flex items-start gap-2 p-1 text-sm text-ink cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={draft.phaseIds.includes(phase.id)}
                                          onChange={(e) => {
                                            const nextPhaseIds = e.target.checked
                                              ? [...draft.phaseIds, phase.id]
                                              : draft.phaseIds.filter((id) => id !== phase.id);
                                            updateDraft(item.id, { phaseIds: nextPhaseIds });
                                          }}
                                          className="mt-0.5 accent-burgundy"
                                        />
                                        <span>
                                          {phase.name}
                                          {phase.branchPath.length > 0 && (
                                            <span className="block text-xs text-ink-faint">
                                              {phase.branchPath.join(' / ')}
                                            </span>
                                          )}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => void handleSaveItem(item.id)}
                                  className="flex-1 px-3 py-2 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors"
                                >
                                  Done
                                </button>
                                <button
                                  onClick={() => handleCancelEdit(item.id)}
                                  className="px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
                                >
                                  Cancel
                                </button>
                                {isEditMode && (
                                  <button
                                    onClick={() =>
                                      setConfirmDelete({ type: 'item', id: item.id, sectionId: section.id })
                                    }
                                    className="px-3 py-2 bg-surface border border-border text-status-need rounded-md text-sm font-semibold hover:bg-status-need/10 transition-colors"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => startEditingItem(item)}
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
                                <div className="flex items-center gap-2">
                                  <div
                                    className="px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide"
                                    style={{
                                      backgroundColor: `color-mix(in srgb, ${statusColors[status]} 15%, transparent)`,
                                      color: statusColors[status],
                                    }}
                                  >
                                    {statusLabels[status]}
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`Edit ${item.name}`}
                                    onClick={(event) => {
                                      // The item summary is also clickable; keep this
                                      // action from bubbling into any parent handler.
                                      event.stopPropagation();
                                      startEditingItem(item);
                                    }}
                                    className="px-2 py-1 text-xs font-semibold text-burgundy hover:underline"
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isArchived && isEditMode && (
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
            {!isArchived && isEditMode && (
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

export default InventoryView;

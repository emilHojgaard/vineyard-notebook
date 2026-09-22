import { useState, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import type { LibraryItem, LibrarySection, LibraryItemType } from '../../types';
import { uid } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useSeasonPermissions } from '../../hooks/useSeasonPermissions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { notifyError } from '../../lib/notifications';
import { DataState } from '../../components/DataState';
import { SaveStatus, type SaveState } from '../../components/SaveStatus';

export function LibraryView() {
  const { library, updateLibrary, currentProject, appState, dataLoading, dataError, connectionStatus, retryData } = useData();
  const { canEditContent } = useSeasonPermissions();
  const isEditMode = canEditContent;

  const [addingSectionName, setAddingSectionName] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [editingItem, setEditingItem] = useState<{ sectionId: string; item: LibraryItem } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'section' | 'item'; id: string; sectionId?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const persistLibrary = async (updatedLibrary: typeof library) => {
    if (!updatedLibrary) return false;
    setSaveState('saving');
    setSaveError(null);
    try {
      await updateLibrary(updatedLibrary);
      setSaveState('saved');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save. Please try again.';
      setSaveError(message);
      setSaveState('failed');
      return false;
    }
  };

  if (dataLoading || dataError) {
    return <DataState loading={dataLoading} error={dataError} connectionStatus={connectionStatus} onRetry={retryData} label="library" />;
  }

  if (!library) {
    return (
      <div className="p-4 text-center text-ink-soft">
        <p>Loading library...</p>
      </div>
    );
  }

  // Get current editing item from library (in case library was updated)
  const getCurrentEditingItem = () => {
    if (!editingItem) return null;
    const section = library.sections.find((s) => s.id === editingItem.sectionId);
    if (!section) return null;
    const item = section.items.find((i) => i.id === editingItem.item.id);
    return item || null;
  };

  const currentEditingItem = getCurrentEditingItem();

  const handleAddSection = async () => {
    if (!addingSectionName.trim()) return;

    const newSection: LibrarySection = {
      id: uid('sec'),
      name: addingSectionName.trim(),
      items: [],
    };

    const updatedLibrary = JSON.parse(JSON.stringify(library));
    updatedLibrary.sections.push(newSection);
    if (await persistLibrary(updatedLibrary)) {
      setAddingSectionName('');
      setAddingSection(false);
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    const updatedLibrary = JSON.parse(JSON.stringify(library));
    updatedLibrary.sections = updatedLibrary.sections.filter((s) => s.id !== sectionId);
    if (await persistLibrary(updatedLibrary)) setConfirmDelete(null);
  };

  const handleAddItem = async (sectionId: string, type: LibraryItemType) => {
    const updatedLibrary = JSON.parse(JSON.stringify(library));
    const section = updatedLibrary.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const newItem: LibraryItem = {
      id: uid('lib'),
      title: 'New Item',
      type,
      content: '',
    };

    section.items.push(newItem);
    if (await persistLibrary(updatedLibrary)) {
      setEditingItem({ sectionId, item: newItem });
    }
  };

  const handleUpdateItem = (sectionId: string, itemId: string, updates: Partial<LibraryItem>) => {
    const updatedLibrary = JSON.parse(JSON.stringify(library));
    const section = updatedLibrary.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const item = section.items.find((i) => i.id === itemId);
    if (!item) return;

    Object.assign(item, updates);
    void persistLibrary(updatedLibrary);
  };

  const handleFileUpload = async (
    sectionId: string,
    itemId: string,
    file: File,
    fieldType: 'content' | 'image'
  ) => {
    if (!currentProject) return;

    setUploading(true);
    try {
      const filename = `${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `projects/${currentProject.id}/library/${filename}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      handleUpdateItem(sectionId, itemId, { [fieldType]: url });
    } catch (error) {
      console.error('File upload failed:', error);
      notifyError('Failed to upload file. Please try again.');
    }
    setUploading(false);
  };

  const handleDeleteItem = async (sectionId: string, itemId: string) => {
    const updatedLibrary = JSON.parse(JSON.stringify(library));
    const section = updatedLibrary.sections.find((s) => s.id === sectionId);
    if (!section) return;

    section.items = section.items.filter((i) => i.id !== itemId);
    if (!await persistLibrary(updatedLibrary)) return;
    setConfirmDelete(null);
    setEditingItem(null);
    setSelectedItem(null);
  };

  const getItemIcon = (type: LibraryItemType): string => {
    switch (type) {
      case 'pdf':
        return 'filetext';
      case 'video':
        return 'play';
      case 'photo':
        return 'image';
      case 'note':
        return 'edit';
    }
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-surface px-4 py-3 border-b border-border">
        <h2 className="text-lg font-bold text-ink text-center">Library</h2>
        <p className="text-xs text-center text-ink-soft mt-1">
          Reference materials &amp; notes
        </p>
      </div>

      <div className="p-4">
        <SaveStatus state={saveState} error={saveError} className="mb-3 block" />
        {library.sections.length === 0 && !addingSection ? (
          <div className="text-center py-8">
            <p className="text-ink-faint mb-3">No library sections yet</p>
            {isEditMode && (
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
            {library.sections.map((section) => (
              <div key={section.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="relative flex items-center justify-center mb-3">
                  <h3 className="text-base font-bold text-ink text-center">{section.name}</h3>
                  {isEditMode && <button
                    onClick={() => setConfirmDelete({ type: 'section', id: section.id })}
                    className="absolute right-0 w-7 h-7 rounded-full flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                  >
                    <Icon name="trash" size={14} />
                  </button>}
                </div>

                {section.items.length === 0 ? (
                  <div className="text-sm text-ink-faint italic py-2 mb-2">
                    No items in this section
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="flex items-center gap-2 px-3 py-3 bg-parchment border border-border rounded-md text-left hover:bg-surface-2 transition-colors"
                      >
                        <Icon name={getItemIcon(item.type) as any} size={16} color="var(--burgundy)" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink truncate">
                            {item.title}
                          </div>
                          <div className="text-xs text-ink-faint capitalize">{item.type}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Add item buttons */}
                <div className="flex flex-wrap justify-center gap-2">
                  {(['note', 'pdf', 'video', 'photo'] as LibraryItemType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleAddItem(section.id, type)}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-md text-xs font-semibold text-ink-soft hover:text-burgundy hover:border-burgundy transition-colors capitalize"
                    >
                      <Icon name={getItemIcon(type) as any} size={13} />
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Add section */}
            {isEditMode && (addingSection ? (
              <div className="bg-surface-2 border border-border rounded-lg p-4">
                <input
                  type="text"
                  value={addingSectionName}
                  onChange={(e) => setAddingSectionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                  placeholder="Section name (e.g. Techniques)"
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
            ))}
          </div>
        )}
      </div>

      {/* View/Edit Item Modal */}
      {selectedItem && !editingItem && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedItem(null)}
          title={selectedItem.type.charAt(0).toUpperCase() + selectedItem.type.slice(1)}
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-ink mb-2">{selectedItem.title}</h3>
            </div>

            {selectedItem.type === 'note' && (
              <div className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                {selectedItem.content || <span className="text-ink-faint italic">No content</span>}
              </div>
            )}

            {selectedItem.type === 'pdf' && selectedItem.content && (
              <a
                href={selectedItem.content}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-burgundy text-white rounded-md font-semibold hover:bg-burgundy-deep transition-colors"
              >
                <Icon name="external" size={16} />
                Open PDF
              </a>
            )}

            {selectedItem.type === 'video' && selectedItem.content && (
              <a
                href={selectedItem.content}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-burgundy text-white rounded-md font-semibold hover:bg-burgundy-deep transition-colors"
              >
                <Icon name="play" size={16} />
                Watch Video
              </a>
            )}

            {selectedItem.type === 'photo' && selectedItem.image && (
              <img
                src={selectedItem.image}
                alt={selectedItem.title}
                className="rounded-md max-w-full"
              />
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const section = library.sections.find((s) =>
                    s.items.some((i) => i.id === selectedItem.id)
                  );
                  if (section) {
                    setEditingItem({ sectionId: section.id, item: selectedItem });
                    setSelectedItem(null);
                  }
                }}
                className="flex-1 px-4 py-2 bg-surface border border-border text-ink rounded-md font-semibold hover:bg-surface-2 transition-colors"
              >
                Edit
              </button>
              {isEditMode && (
                <button
                  onClick={() => {
                    const section = library.sections.find((s) =>
                      s.items.some((i) => i.id === selectedItem.id)
                    );
                    if (section) {
                      setConfirmDelete({ type: 'item', id: selectedItem.id, sectionId: section.id });
                    }
                  }}
                  className="px-4 py-2 bg-status-need/10 border border-status-need/30 text-status-need rounded-md font-semibold hover:bg-status-need/20 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Item Modal */}
      {editingItem && currentEditingItem && (
        <Modal
          isOpen={true}
          onClose={() => setEditingItem(null)}
          title={`Edit ${currentEditingItem.type.charAt(0).toUpperCase() + currentEditingItem.type.slice(1)}`}
        >
          <div className="space-y-4">
            <SaveStatus state={saveState} error={saveError} />
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-ink-faint block mb-2">
                Title
              </label>
              <input
                type="text"
                value={currentEditingItem.title}
                onChange={(e) =>
                  handleUpdateItem(editingItem.sectionId, currentEditingItem.id, {
                    title: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm font-semibold"
              />
            </div>

            {currentEditingItem.type === 'note' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-ink-faint block mb-2">
                  Content
                </label>
                <textarea
                  value={currentEditingItem.content}
                  onChange={(e) =>
                    handleUpdateItem(editingItem.sectionId, currentEditingItem.id, {
                      content: e.target.value,
                    })
                  }
                  rows={10}
                  className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm resize-vertical"
                />
              </div>
            )}

            {(currentEditingItem.type === 'pdf' || currentEditingItem.type === 'video') && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-ink-faint block mb-2">
                  {currentEditingItem.type === 'pdf' ? 'PDF File' : 'Video URL or File'}
                </label>
                <input
                  type="text"
                  value={currentEditingItem.content}
                  onChange={(e) =>
                    handleUpdateItem(editingItem.sectionId, currentEditingItem.id, {
                      content: e.target.value,
                    })
                  }
                  placeholder={currentEditingItem.type === 'video' ? 'YouTube URL or upload file' : 'URL or upload file'}
                  className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm mb-2"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={currentEditingItem.type === 'pdf' ? '.pdf' : 'video/*'}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(editingItem.sectionId, currentEditingItem.id, file, 'content');
                    }
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm font-semibold text-ink hover:bg-surface-2 transition-colors disabled:opacity-40"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            )}

            {currentEditingItem.type === 'photo' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-ink-faint block mb-2">
                  Photo
                </label>
                {currentEditingItem.image && (
                  <img
                    src={currentEditingItem.image}
                    alt="Preview"
                    className="rounded-md max-w-full mb-2"
                  />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(editingItem.sectionId, currentEditingItem.id, file, 'image');
                    }
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm font-semibold text-ink hover:bg-surface-2 transition-colors disabled:opacity-40"
                >
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 px-4 py-2 bg-burgundy text-white rounded-md font-semibold hover:bg-burgundy-deep transition-colors"
              >
                Done
              </button>
              {isEditMode && (
                <button
                  onClick={() =>
                    setConfirmDelete({
                      type: 'item',
                      id: currentEditingItem.id,
                      sectionId: editingItem.sectionId,
                    })
                  }
                  className="px-4 py-2 bg-status-need/10 border border-status-need/30 text-status-need rounded-md font-semibold hover:bg-status-need/20 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

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

export default LibraryView;

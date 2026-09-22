import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ProjectSetup } from '../features/auth/ProjectSetup';
import { ConfirmDialog } from './ConfirmDialog';
import { deleteProject } from '../lib/repositories/projects-repository';
import { notifyError } from '../lib/notifications';

interface HeaderProps {
  onSettingsClick: () => void;
  onMembersClick: () => void;
}

export function Header({ onSettingsClick, onMembersClick }: HeaderProps) {
  const { currentProject, projects, selectProject, appState, updateAppState } = useData();
  const { currentUser, logout } = useAuth();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null);
  const canDeleteProjects = currentUser?.uid === currentProject?.createdBy;
  const isEditMode = !appState.locked;

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);

      // Select another project if available
      if (currentProject?.id === projectId && projects.length > 1) {
        const nextProject = projects.find(p => p.id !== projectId);
        if (nextProject) {
          selectProject(nextProject.id);
        }
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      notifyError('Failed to delete project. Please try again.');
    }
    setConfirmDeleteProject(null);
  };

  const toggleLock = () => {
    updateAppState({ locked: !appState.locked });
  };

  useEffect(() => {
    if (!showProjectDropdown && !showUserMenu) return;
    const closeMenus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProjectDropdown(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener('keydown', closeMenus);
    return () => document.removeEventListener('keydown', closeMenus);
  }, [showProjectDropdown, showUserMenu]);

  return (
    <>
      <div className="relative bg-burgundy text-white px-3 sm:px-4 py-3 flex items-center justify-between flex-shrink-0">
        {/* Lock control stays on the left. */}
        <button
          onClick={toggleLock}
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors flex-shrink-0 ${
            appState.locked
              ? 'bg-white/25 border-white/50'
              : 'bg-white/10 border-white/30 hover:bg-white/20'
          }`}
          title={appState.locked ? 'Locked - Click to edit' : 'Unlocked - Click to lock'}
          aria-label={appState.locked ? 'Unlock editing' : 'Lock editing'}
        >
          <Icon name={appState.locked ? 'lock' : 'unlock'} size={12} />
        </button>

        {/* The single project-name presentation is centered in both modes. */}
        <div className="absolute left-1/2 -translate-x-1/2 max-w-[45%] sm:max-w-[55%]">
          {isEditMode ? (
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="flex items-center gap-1 max-w-full px-2 py-1 rounded hover:bg-white/10 transition-colors text-xs font-bold tracking-widest uppercase"
                title="Manage projects"
                aria-haspopup="menu"
                aria-expanded={showProjectDropdown}
              >
                <span className="truncate">{currentProject?.name || 'Vineyard Notebook'}</span>
                <Icon name="chevronDown" size={10} />
              </button>
              {showProjectDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProjectDropdown(false)} />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-56 max-w-[calc(100vw-2rem)] bg-parchment border border-border rounded-lg shadow-phone z-50 overflow-hidden" role="menu">
                    <div className="py-1">
                      {projects.map((project) => (
                        <div key={project.id} className="flex items-center group">
                          <button
                            onClick={() => { selectProject(project.id); setShowProjectDropdown(false); }}
                            className={`flex-1 min-w-0 px-4 py-2 text-left text-sm truncate hover:bg-surface transition-colors ${currentProject?.id === project.id ? 'bg-surface text-burgundy font-semibold' : 'text-ink'}`}
                            role="menuitem"
                          >
                            {project.name}
                          </button>
                          {canDeleteProjects && projects.length > 1 && (
                            <button
                              onClick={() => { setConfirmDeleteProject(project.id); setShowProjectDropdown(false); }}
                              className="px-2 py-2 text-status-need hover:bg-surface transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                              title="Delete project"
                              aria-label={`Delete ${project.name}`}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => { setShowNewProject(true); setShowProjectDropdown(false); }}
                        className="w-full px-4 py-2 text-left text-sm text-burgundy font-semibold hover:bg-surface transition-colors flex items-center gap-2"
                        role="menuitem"
                      >
                        <Icon name="plus" size={12} />
                        Create New Project
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="truncate text-xs font-bold tracking-widest uppercase" title={currentProject?.name || 'Vineyard Notebook'}>
              {currentProject?.name || 'Vineyard Notebook'}
            </div>
          )}
        </div>

        {/* Keep secondary actions together in one touch-friendly menu. */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-9 h-9 rounded-full bg-white/10 border border-white/30 flex items-center justify-center hover:bg-white/20 transition-colors"
            title="More options"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
          >
            <Icon name="more" size={17} />
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-56 bg-parchment border border-border rounded-lg shadow-phone z-50 overflow-hidden" role="menu">
                <div className="px-4 py-3 border-b border-border">
                  <div className="text-sm font-semibold text-ink">{currentUser?.displayName || 'User'}</div>
                  <div className="text-xs text-ink-soft truncate">{currentUser?.email}</div>
                </div>
                <button onClick={() => { onMembersClick(); setShowUserMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface transition-colors flex items-center gap-2" role="menuitem">
                  <Icon name="users" size={14} /> Members
                </button>
                <button onClick={() => { onSettingsClick(); setShowUserMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface transition-colors flex items-center gap-2" role="menuitem">
                  <Icon name="settings" size={14} /> Settings
                </button>
                <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full px-4 py-2 text-left text-sm text-status-need font-semibold hover:bg-surface transition-colors" role="menuitem">Sign Out</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-parchment rounded-xl max-w-sm w-full shadow-phone">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-ink">Create New Project</h3>
              <button
                onClick={() => setShowNewProject(false)}
                className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surface-2"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <div className="p-4">
              <ProjectSetup onComplete={() => setShowNewProject(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation */}
      {confirmDeleteProject && (
        <ConfirmDialog
          isOpen={true}
          title="Delete Project"
          message={`Are you sure you want to delete "${projects.find(p => p.id === confirmDeleteProject)?.name}"? This will delete all seasons, inventory, and library data. This action cannot be undone.`}
          confirmText="Delete"
          onConfirm={() => handleDeleteProject(confirmDeleteProject)}
          onCancel={() => setConfirmDeleteProject(null)}
          isDanger={true}
        />
      )}
    </>
  );
}

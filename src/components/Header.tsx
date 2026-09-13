import React, { useState } from 'react';
import { Icon } from './Icon';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ProjectSetup } from '../features/auth/ProjectSetup';
import { ConfirmDialog } from './ConfirmDialog';
import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  const isEditMode = !appState.locked;

  const handleDeleteProject = async (projectId: string) => {
    try {
      // Delete all seasons for this project
      const seasonsQuery = query(
        collection(db, 'seasons'),
        where('projectId', '==', projectId)
      );
      const seasonDocs = await getDocs(seasonsQuery);
      await Promise.all(seasonDocs.docs.map(doc => deleteDoc(doc.ref)));

      // Delete all inventory for this project
      const inventoryQuery = query(
        collection(db, 'inventory'),
        where('projectId', '==', projectId)
      );
      const inventoryDocs = await getDocs(inventoryQuery);
      await Promise.all(inventoryDocs.docs.map(doc => deleteDoc(doc.ref)));

      // Delete library
      await deleteDoc(doc(db, 'library', projectId));

      // Delete project
      await deleteDoc(doc(db, 'projects', projectId));

      // Select another project if available
      if (currentProject?.id === projectId && projects.length > 1) {
        const nextProject = projects.find(p => p.id !== projectId);
        if (nextProject) {
          selectProject(nextProject.id);
        }
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    }
    setConfirmDeleteProject(null);
  };

  const toggleLock = () => {
    updateAppState({ locked: !appState.locked });
  };

  return (
    <>
      <div className="bg-burgundy text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        {/* Project Name / Logo */}
        <div className="text-xs font-bold tracking-widest uppercase flex-shrink-0">
          {currentProject?.name || 'Vineyard Notebook'}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Project Selector (only visible in edit mode) */}
          {isEditMode && (
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 border border-white/30 hover:bg-white/20 transition-colors text-xs"
                title="Manage projects"
              >
                <Icon name="folder" size={12} />
                <Icon name="chevronDown" size={10} />
              </button>
              
              {showProjectDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProjectDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-parchment border border-border rounded-lg shadow-phone z-50 overflow-hidden">
                    <div className="py-1">
                      {projects.map((project) => (
                        <div key={project.id} className="flex items-center group">
                          <button
                            onClick={() => {
                              selectProject(project.id);
                              setShowProjectDropdown(false);
                            }}
                            className={`flex-1 px-4 py-2 text-left text-sm hover:bg-surface transition-colors ${
                              currentProject?.id === project.id
                                ? 'bg-surface text-burgundy font-semibold'
                                : 'text-ink'
                            }`}
                          >
                            {project.name}
                          </button>
                          {projects.length > 1 && (
                            <button
                              onClick={() => {
                                setConfirmDeleteProject(project.id);
                                setShowProjectDropdown(false);
                              }}
                              className="px-2 py-2 text-status-need hover:bg-surface transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete project"
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => {
                          setShowNewProject(true);
                          setShowProjectDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-burgundy font-semibold hover:bg-surface transition-colors flex items-center gap-2"
                      >
                        <Icon name="plus" size={12} />
                        Create New Project
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Members button */}
          <button
            onClick={onMembersClick}
            className="w-6 h-6 rounded-full bg-white/10 border border-white/30 flex items-center justify-center hover:bg-white/20 transition-colors"
            title="Members"
          >
            <Icon name="users" size={12} />
          </button>

          {/* Settings button */}
          <button
            onClick={onSettingsClick}
            className="w-6 h-6 rounded-full bg-white/10 border border-white/30 flex items-center justify-center hover:bg-white/20 transition-colors"
            title="Settings"
          >
            <Icon name="settings" size={12} />
          </button>

          {/* Lock/Unlock button */}
          <button
            onClick={toggleLock}
            className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
              appState.locked
                ? 'bg-white/25 border-white/50'
                : 'bg-white/10 border-white/30 hover:bg-white/20'
            }`}
            title={appState.locked ? 'Locked - Click to edit' : 'Unlocked - Click to lock'}
          >
            <Icon name={appState.locked ? 'lock' : 'unlock'} size={12} />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-7 h-7 rounded-full bg-white/10 border border-white/30 flex items-center justify-center hover:bg-white/20 transition-colors"
              title={currentUser?.email || 'User'}
            >
              <Icon name="user" size={14} />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-56 bg-parchment border border-border rounded-lg shadow-phone z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <div className="text-sm font-semibold text-ink">
                      {currentUser?.displayName || 'User'}
                    </div>
                    <div className="text-xs text-ink-soft truncate">
                      {currentUser?.email}
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-status-need font-semibold hover:bg-surface transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
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

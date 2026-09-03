import React, { useState } from 'react';
import { Icon } from './Icon';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ProjectSetup } from '../features/auth/ProjectSetup';

export function Header() {
  const { currentProject, projects, selectProject } = useData();
  const { currentUser, logout } = useAuth();
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  return (
    <>
      <div className="bg-burgundy text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        {/* Logo/Brand */}
        <div className="text-xs font-bold tracking-widest uppercase flex-shrink-0">
          Vineyard Notebook
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Project Selector */}
          <div className="relative">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 border border-white/30 hover:bg-white/20 transition-colors text-xs"
            >
              <span className="max-w-[100px] truncate">
                {currentProject?.name || 'No project'}
              </span>
              <Icon name="chevronDown" size={10} />
            </button>
            
            {showProjectDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProjectDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-parchment border border-border rounded-lg shadow-phone z-50 overflow-hidden">
                  <div className="py-1">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => {
                          selectProject(project.id);
                          setShowProjectDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-surface transition-colors ${
                          currentProject?.id === project.id
                            ? 'bg-surface text-burgundy font-semibold'
                            : 'text-ink'
                        }`}
                      >
                        {project.name}
                      </button>
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
    </>
  );
}

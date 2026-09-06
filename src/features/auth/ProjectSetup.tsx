import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';

interface ProjectSetupProps {
  onComplete?: () => void;
}

export function ProjectSetup({ onComplete }: ProjectSetupProps = {}) {
  const { projects, createProject, selectProject } = useData();
  const [showCreateForm, setShowCreateForm] = useState(projects.length === 0);
  const [projectName, setProjectName] = useState('');
  const [seasonTitle, setSeasonTitle] = useState(`${new Date().getFullYear()}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const projectId = await createProject(projectName, seasonTitle);
      selectProject(projectId);
      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  if (!showCreateForm && projects.length > 0) {
    return (
      <div className={onComplete ? '' : 'min-h-screen bg-page-bg flex items-center justify-center p-4'}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-burgundy mb-2">
              Select a Project
            </h1>
            <p className="text-ink-soft text-sm">
              Choose a vineyard or create a new one
            </p>
          </div>

          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => selectProject(project.id)}
                className="w-full bg-surface border border-border rounded-lg p-4 text-left hover:bg-surface-2 transition-colors"
              >
                <div className="font-semibold text-ink">{project.name}</div>
                <div className="text-xs text-ink-soft mt-1">
                  {project.members.length} member{project.members.length !== 1 ? 's' : ''}
                </div>
              </button>
            ))}

            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full border-2 border-dashed border-border rounded-lg p-4 text-burgundy hover:bg-surface-2 transition-colors font-semibold"
            >
              + Create New Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={onComplete ? '' : 'min-h-screen bg-page-bg flex items-center justify-center p-4'}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-burgundy mb-2">
            Create Your Vineyard
          </h1>
          <p className="text-ink-soft text-sm">
            Set up your first project to start tracking
          </p>
        </div>

        <div className={onComplete ? '' : 'bg-surface border border-border rounded-xl p-6 shadow-phone'}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-status-need rounded-lg text-status-need text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-faint mb-2">
                Vineyard Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-parchment text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
                placeholder="e.g., Hillside Vineyard"
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-ink-faint mb-2">
                Initial Season Title
              </label>
              <input
                type="text"
                value={seasonTitle}
                onChange={(e) => setSeasonTitle(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg bg-parchment text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
                placeholder="e.g., 2026"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-burgundy text-white rounded-lg font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>

            {projects.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="w-full py-2 text-sm text-burgundy hover:underline"
              >
                Back to project list
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

import type { Project } from '../types';

function sameProject(left: Project, right: Project): boolean {
  return left.id === right.id
    && left.name === right.name
    && left.createdBy === right.createdBy
    && left.members.join(',') === right.members.join(',')
    && JSON.stringify(left.owners || []) === JSON.stringify(right.owners || []);
}

export interface ProjectSelection {
  project: Project | null;
  pendingProject: Project | null;
}

/**
 * Reconcile a project-list snapshot without allowing a cached snapshot to
 * undo a project selection made by a successful create.
 */
export function reconcileProjectSelection(
  loadedProjects: Project[],
  selectedProject: Project | null,
  pendingProject: Project | null,
): ProjectSelection {
  if (pendingProject) {
    const confirmedProject = loadedProjects.find((project) => project.id === pendingProject.id);
    if (confirmedProject) {
      return {
        project: selectedProject && sameProject(selectedProject, confirmedProject)
          ? selectedProject
          : confirmedProject,
        pendingProject: null,
      };
    }
    return { project: pendingProject, pendingProject };
  }

  const loadedSelection = selectedProject
    ? loadedProjects.find((project) => project.id === selectedProject.id)
    : undefined;
  if (loadedSelection) {
    return {
      project: sameProject(selectedProject!, loadedSelection) ? selectedProject : loadedSelection,
      pendingProject: null,
    };
  }

  return { project: loadedProjects[0] || null, pendingProject: null };
}

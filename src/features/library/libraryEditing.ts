import type { Library, LibraryItem } from '../../types';

export function updateLibraryItem(
  library: Library,
  sectionId: string,
  itemId: string,
  updates: Partial<LibraryItem>,
): Library | null {
  const section = library.sections.find((candidate) => candidate.id === sectionId);
  if (!section || !section.items.some((item) => item.id === itemId)) return null;

  return {
    ...library,
    sections: library.sections.map((candidate) =>
      candidate.id === sectionId
        ? {
            ...candidate,
            items: candidate.items.map((item) =>
              item.id === itemId ? { ...item, ...updates } : item,
            ),
          }
        : candidate,
    ),
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { updateLibraryItem } from '../src/features/library/libraryEditing.ts';
import type { Library } from '../src/types/index.ts';

test('typing multiple characters keeps the draft value and saves the complete item', () => {
  const library: Library = {
    revision: 4,
    sections: [{
      id: 'references',
      name: 'References',
      items: [{ id: 'guide', title: 'Guide', type: 'note', content: '' }],
    }],
  };
  let draft = library.sections[0].items[0];
  let pending = draft;

  for (const character of 'Harvest notes') {
    pending = { ...pending, content: pending.content + character };
    draft = pending;
  }

  const saved = updateLibraryItem(library, 'references', 'guide', draft);

  assert.equal(draft.content, 'Harvest notes');
  assert.equal(saved?.sections[0].items[0].content, 'Harvest notes');
  assert.equal(library.sections[0].items[0].content, '');
});

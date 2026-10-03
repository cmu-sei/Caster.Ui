// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { ModelFile } from '../../generated/caster-api';
import { recordEmissions } from '../../test-utils/record-emissions';
import { FileQuery } from './file.query';
import { FileStore } from './file.store';

// Real store + real query, no TestBed.

function file(overrides: Partial<ModelFile> = {}): ModelFile {
  return { id: 'f1', name: 'main.tf', directoryId: 'd1', ...overrides };
}

function setup(files: ModelFile[] = []) {
  const store = new FileStore();
  const query = new FileQuery(store);
  store.add(files);
  return { store, query };
}

describe('FileQuery', () => {
  /**
   * Verifies: files come out in case-insensitive name order (@QueryConfig).
   * Interacts with: QueryEntity.selectAll + @QueryConfig sortBy 'name'.
   * Data: files 'vars.tf', 'Main.tf', 'outputs.tf' added in that order.
   */
  it('sorts files by name, ignoring case', async () => {
    const { query } = setup([
      file({ id: 'v', name: 'vars.tf' }),
      file({ id: 'm', name: 'Main.tf' }),
      file({ id: 'o', name: 'outputs.tf' }),
    ]);

    const all = await firstValueFrom(query.selectAll());

    expect(all.map((f) => f.id)).toEqual(['m', 'o', 'v']);
  });

  /**
   * Verifies: getSelectedVersionId emits '' for a new file and follows the
   *   file's UI state.
   * Interacts with: ui.selectEntity(selectedVersionId).
   * Data: file f1; UI updated to version v2.
   */
  it('selects the selected version of a file', () => {
    const { store, query } = setup([file()]);
    const seen = recordEmissions(query.getSelectedVersionId('f1'));

    store.ui.update('f1', { selectedVersionId: 'v2' });

    expect(seen).toEqual(['', 'v2']);
  });

  /**
   * Verifies: isEditing is true only while the file is locked by the given
   *   user, and emits undefined for an unknown file.
   * Interacts with: selectEntity(lockedById projection).
   * Data: f1 locked by u1; asked for u1 and u2; then unlocked.
   */
  it('reports whether a user holds the file lock', async () => {
    const { store, query } = setup([file({ lockedById: 'u1' })]);
    const mine = recordEmissions(query.isEditing('f1', 'u1'));

    expect(await firstValueFrom(query.isEditing('f1', 'u2'))).toBe(false);
    store.update('f1', { lockedById: null });

    expect(mine).toEqual([true, false]);
    expect(
      await firstValueFrom(query.isEditing('missing', 'u1')),
    ).toBeUndefined();
  });

  /**
   * Verifies: selectIsSaved and isSaved read the file's isSaved UI flag.
   * Interacts with: ui.selectEntity / ui.getEntity.
   * Data: f1 (saved by default), then marked unsaved.
   */
  it('reads the saved flag as a stream and as a value', () => {
    const { store, query } = setup([file()]);
    const seen = recordEmissions(query.selectIsSaved('f1'));

    store.ui.update('f1', { isSaved: false });

    expect(seen).toEqual([true, false]);
    expect(query.isSaved('f1')).toBe(false);
  });

  /**
   * Verifies: isSaved throws for a file with no UI state, while selectIsSaved
   *   emits undefined.
   * Interacts with: ui.getEntity(missing).isSaved.
   * Data: an empty store.
   */
  it('throws from isSaved for an unknown file', async () => {
    const { query } = setup();

    // NOTE: callers only ask about files that are open in the editor.
    expect(() => query.isSaved('missing')).toThrow(TypeError);
    expect(
      await firstValueFrom(query.selectIsSaved('missing')),
    ).toBeUndefined();
  });
});

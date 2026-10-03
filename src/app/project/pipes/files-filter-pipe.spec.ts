// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { ModelFile } from '../../generated/caster-api';
import { FilesFilterPipe } from './files-filter-pipe';

const files: ModelFile[] = [
  { id: 'root-1', name: 'main.tf', directoryId: 'd1', workspaceId: null },
  { id: 'w1-1', name: 'w1.tfvars', directoryId: 'd1', workspaceId: 'w1' },
  { id: 'root-2', name: 'vars.tf', directoryId: 'd1', workspaceId: null },
  { id: 'w2-1', name: 'w2.tfvars', directoryId: 'd1', workspaceId: 'w2' },
  { id: 'no-ws', name: 'partial.tf', directoryId: 'd1' },
];

const ids = (list: ModelFile[]) => list.map((f) => f.id);

describe('FilesFilterPipe', () => {
  const pipe = new FilesFilterPipe();

  /**
   * Verifies: with a workspace id, only that workspace's files are returned, in their original order.
   * Interacts with: FilesFilterPipe.transform (used as `filesFilter: obj.id` in directory-panel.component.html:168).
   * Data: files in the directory root, in w1, in w2, and one with no workspaceId.
   */
  it("returns a workspace's files for its id", () => {
    expect(ids(pipe.transform(files, 'w1'))).toEqual(['w1-1']);
    expect(ids(pipe.transform(files, 'w2'))).toEqual(['w2-1']);
    expect(pipe.transform(files, 'unknown')).toEqual([]);
  });

  /**
   * Verifies: without a workspace id (null or ''), only directory-level files (workspaceId === null) are returned.
   * Interacts with: FilesFilterPipe.transform (used as `filesFilter: null` in directory-panel.component.html:46).
   * Data: the same files; args null and ''.
   */
  it('returns the directory-level files without a workspace id', () => {
    expect(ids(pipe.transform(files, null))).toEqual(['root-1', 'root-2']);
    expect(ids(pipe.transform(files, ''))).toEqual(['root-1', 'root-2']);
  });

  /**
   * Verifies: a file whose workspaceId is undefined (rather than null) appears in neither list.
   * Interacts with: FilesFilterPipe.transform.
   * Data: 'no-ws' has no workspaceId property.
   */
  it('hides files whose workspaceId is undefined', () => {
    const shown = [
      ...pipe.transform(files, null),
      ...pipe.transform(files, 'w1'),
      ...pipe.transform(files, 'w2'),
    ];

    // NOTE: the root list uses a strict `=== null`. The API serializes nulls,
    // so files loaded from it always carry workspaceId; only a client-built
    // ModelFile without the property would disappear.
    expect(ids(shown)).not.toContain('no-ws');
  });

  /**
   * Verifies: the pipe returns a new array and leaves the input alone.
   * Interacts with: FilesFilterPipe.transform.
   * Data: a copy of the files list.
   */
  it('does not mutate the input', () => {
    const input = [...files];

    const result = pipe.transform(input, null);

    expect(result).not.toBe(input);
    expect(input).toEqual(files);
  });

  /**
   * Verifies: a null list (for example `async` before a first value) throws a TypeError.
   * Interacts with: FilesFilterPipe.transform.
   * Data: value null.
   */
  it('throws for a null list', () => {
    // NOTE: safe today because the template's files$ is an Akita selectAll,
    // which emits synchronously, so `files$ | async` is never null.
    expect(() => pipe.transform(null, null)).toThrow(TypeError);
  });
});

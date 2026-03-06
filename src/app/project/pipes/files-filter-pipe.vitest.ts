// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { FilesFilterPipe } from './files-filter-pipe';
import { ModelFile } from 'src/app/generated/caster-api';

describe('FilesFilterPipe', () => {
  const pipe = new FilesFilterPipe();

  const files: ModelFile[] = [
    { id: 'f1', name: 'main.tf', workspaceId: null } as ModelFile,
    { id: 'f2', name: 'vars.tf', workspaceId: 'ws-1' } as ModelFile,
    { id: 'f3', name: 'output.tf', workspaceId: 'ws-1' } as ModelFile,
    { id: 'f4', name: 'data.tf', workspaceId: 'ws-2' } as ModelFile,
    { id: 'f5', name: 'loose.tf', workspaceId: null } as ModelFile,
  ];

  it('should be created', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return files with null workspaceId when no args provided', () => {
    const result = pipe.transform(files, undefined);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id)).toEqual(['f1', 'f5']);
  });

  it('should return files matching a specific workspaceId', () => {
    const result = pipe.transform(files, 'ws-1');
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id)).toEqual(['f2', 'f3']);
  });

  it('should return empty array when no files match the workspaceId', () => {
    const result = pipe.transform(files, 'ws-nonexistent');
    expect(result).toHaveLength(0);
  });

  it('should return empty array when input is empty', () => {
    const result = pipe.transform([], 'ws-1');
    expect(result).toHaveLength(0);
  });

  it('should return files for ws-2', () => {
    const result = pipe.transform(files, 'ws-2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f4');
  });
});

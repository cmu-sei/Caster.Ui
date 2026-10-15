// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, Subject, throwError } from 'rxjs';
import { FilesService, FileVersion } from '../../generated/caster-api';
import { ApiStub } from '../../test-utils/api-stub';
import { getDefaultProviders } from '../../test-utils/default-test-providers';
import { recordEmissions } from '../../test-utils/record-emissions';
import { FileVersionQuery } from './fileVersion.query';
import { FileVersionService } from './fileVersion.service';
import { FileVersionStore } from './fileVersion.store';

function version(overrides: Partial<FileVersion> = {}): FileVersion {
  return {
    id: 'fv1',
    fileId: 'f1',
    name: 'main.tf',
    dateSaved: '2026-01-01T00:00:00Z',
    content: 'v1',
    tag: null,
    ...overrides,
  };
}

/** Real FileVersionStore, query and service; FilesService stubbed. */
function setup(api: ApiStub<FilesService> = {}, versions: FileVersion[] = []) {
  TestBed.configureTestingModule({
    providers: getDefaultProviders([{ provide: FilesService, useValue: api }]),
  });
  const store = TestBed.inject(FileVersionStore);
  const query = TestBed.inject(FileVersionQuery);
  const service = TestBed.inject(FileVersionService);
  store.add(versions);
  return { service, store, query };
}

describe('FileVersionService', () => {
  /**
   * Verifies: load turns loading on immediately, asks for the file's
   *   versions, upserts each (keeping versions of other files) and clears
   *   loading.
   * Interacts with: FilesService.getFileVersions (Subject stub).
   * Data: stored fv9 of file f9; the API returns fv1 and fv2 of f1.
   */
  it('load() upserts a file versions and toggles loading', () => {
    const response$ = new Subject<FileVersion[]>();
    const api = {
      getFileVersions: vi.fn(() => response$),
    } satisfies ApiStub<FilesService>;
    const { service, query } = setup(api, [
      version({ id: 'fv9', fileId: 'f9' }),
    ]);

    const load$ = service.load('f1');
    expect(query.getValue().loading).toBe(true);
    recordEmissions(load$);
    expect(api.getFileVersions).toHaveBeenCalledWith('f1');

    response$.next([version(), version({ id: 'fv2', content: 'v2' })]);

    expect(
      query
        .getAll()
        .map((v) => v.id)
        .sort(),
    ).toEqual(['fv1', 'fv2', 'fv9']);
    expect(query.getValue().loading).toBe(false);
  });

  const boom = () => throwError(() => new Error('boom'));
  const failingLoads: {
    method: string;
    api: () => ApiStub<FilesService>;
    call: (s: FileVersionService) => Observable<unknown>;
  }[] = [
    {
      method: 'load',
      api: () => ({ getFileVersions: vi.fn(boom) }),
      call: (s) => s.load('f1'),
    },
    {
      method: 'loadFileVersionById',
      api: () => ({ getFileVersion: vi.fn(boom) }),
      call: (s) => s.loadFileVersionById('fv1'),
    },
  ];

  /**
   * Verifies: each loading-tracked load passes the error on and leaves
   *   loading on.
   * Interacts with: the row's FilesService method (throwError stub).
   * Data: stored fv1 (loading false); the API errors with 'boom'.
   */
  it.each(failingLoads)(
    '$method() leaves loading on when the API fails',
    async ({ api, call }) => {
      const { service, query } = setup(api(), [version()]);

      const error = await firstValueFrom(call(service)).catch(
        (e: unknown) => e,
      );

      expect(error).toEqual(new Error('boom'));
      expect(query.getValue().loading).toBe(true);
    },
  );

  /**
   * Verifies: loadFileVersionById upserts one version and clears loading.
   * Interacts with: FilesService.getFileVersion (stub).
   * Data: stored fv1 untagged; the API returns fv1 tagged 'release'.
   */
  it('loadFileVersionById() upserts one version', async () => {
    const api = {
      getFileVersion: vi.fn(() => of(version({ tag: 'release' }))),
    } satisfies ApiStub<FilesService>;
    const { service, query } = setup(api, [version()]);

    await firstValueFrom(service.loadFileVersionById('fv1'));

    expect(api.getFileVersion).toHaveBeenCalledWith('fv1');
    expect(query.getEntity('fv1').tag).toBe('release');
    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: tagFiles subscribes itself, sends the tag and file ids, and
   *   upserts the tagged versions; loading is only cleared when a new
   *   version is added.
   * Interacts with: FilesService.tagFiles (stub); FileVersionStore.upsert.
   * Data: stored fv1 (loading false); first the API returns only fv1 tagged,
   *   then a new fv2.
   */
  it('tagFiles() upserts the tagged versions and leaves loading on for known versions', () => {
    const api = {
      tagFiles: vi.fn(() => of([version({ tag: 'release' })])),
    } satisfies ApiStub<FilesService>;
    const { service, query } = setup(api, [version()]);

    service.tagFiles('release', ['f1']);

    expect(api.tagFiles).toHaveBeenCalledWith({
      tag: 'release',
      fileIds: ['f1'],
    });
    expect(query.getEntity('fv1').tag).toBe('release');
    expect(query.getValue().loading).toBe(true);

    api.tagFiles.mockReturnValue(of([version({ id: 'fv2', tag: 'release' })]));
    service.tagFiles('release', ['f1']);

    expect(query.getValue().loading).toBe(false);
  });

  /**
   * Verifies: toggleSelected flips a version's isSelected flag, and setActive
   *   marks it active in both stores.
   * Interacts with: FileVersionStore.ui.upsert/setActive; isUpdate.
   * Data: stored fv1.
   */
  it('toggles selection and sets the active version', () => {
    const { service, query } = setup({}, [version()]);

    service.toggleSelected('fv1');
    expect(query.ui.getEntity('fv1').isSelected).toBe(true);
    service.toggleSelected('fv1');
    expect(query.ui.getEntity('fv1').isSelected).toBe(false);

    service.setActive('fv1');
    expect(query.getValue().active).toBe('fv1');
    expect(query.ui.getValue().active).toBe('fv1');
  });
});

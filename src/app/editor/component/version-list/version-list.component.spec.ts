// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FileVersionStore } from 'src/app/fileVersions/state/fileVersion.store';
import { FileVersion } from 'src/app/generated/caster-api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { VersionListComponent } from './version-list.component';

async function renderVersionList(versions: FileVersion[]) {
  const getVersion = vi.fn<(v: { id: string }) => void>();
  const revertToVersion = vi.fn<(v: { fileVersion: FileVersion }) => void>();
  const view = await renderComponent(VersionListComponent, {
    imports: [
      MatCardModule,
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
    ],
    inputs: { fileId: 'f1', selectedVersionId: '' },
    on: { getVersion, revertToVersion },
  });
  TestBed.inject(FileVersionStore).set(versions);
  view.fixture.detectChanges();
  return { ...view, getVersion, revertToVersion, user: userEvent.setup() };
}

describe('VersionListComponent', () => {
  /**
   * Verifies: the file's versions are listed newest first, versions of other files are left out, and Revert emits the version.
   * Interacts with: real FileVersionQuery, the revertToVersion output.
   * Data: versions v1 (Jan) and v2 (Feb) of f1, v9 of f9.
   */
  it('lists the file versions newest first and reverts one', async () => {
    const { revertToVersion, user } = await renderVersionList([
      {
        id: 'v1',
        fileId: 'f1',
        name: 'one',
        modifiedByName: 'Ada',
        dateSaved: '2026-01-01T00:00:00Z',
      },
      {
        id: 'v2',
        fileId: 'f1',
        name: 'two',
        modifiedByName: 'Ada',
        dateSaved: '2026-02-01T00:00:00Z',
      },
      {
        id: 'v9',
        fileId: 'f9',
        name: 'other',
        modifiedByName: 'Ada',
        dateSaved: '2026-03-01T00:00:00Z',
      },
    ]);

    const names = screen
      .getAllByText(/ by Ada as /)
      .map((e) => e.textContent?.replace(/\s+/g, ' ').trim().split(' as ')[1]);
    expect(names).toEqual(['two', 'one']);
    await user.click(screen.getAllByRole('button', { name: 'Revert' })[0]);

    expect(revertToVersion).toHaveBeenCalledWith({
      fileVersion: expect.objectContaining({ id: 'v2' }),
    });
  });

  /**
   * Verifies: a file without versions shows the empty message.
   * Interacts with: real FileVersionQuery.
   * Data: no versions.
   */
  it('shows a message when the file has no versions', async () => {
    await renderVersionList([]);

    expect(screen.getByText('No saved versions ...')).toBeInTheDocument();
  });
});

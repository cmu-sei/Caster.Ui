// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { VersionListComponent } from './version-list.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { FileVersionQuery } from 'src/app/fileVersions/state';
import { FileVersion } from 'src/app/generated/caster-api';
import { SharedModule } from 'src/app/shared/shared.module';

const mockVersions: FileVersion[] = [
  {
    id: 'fv1',
    fileId: 'f1',
    name: 'main.tf',
    content: 'resource "null_resource" {}',
    dateSaved: '2024-01-15T10:00:00Z',
    modifiedByName: 'Alice Smith',
    tag: 'v1.0',
    taggedByName: 'Bob Jones',
    dateTagged: '2024-01-16T10:00:00Z',
  },
  {
    id: 'fv2',
    fileId: 'f1',
    name: 'main.tf',
    content: 'resource "aws_instance" {}',
    dateSaved: '2024-02-20T14:30:00Z',
    modifiedByName: 'Charlie Brown',
    tag: null,
    taggedByName: null,
    dateTagged: null,
  },
  {
    id: 'fv3',
    fileId: 'f1',
    name: 'variables.tf',
    content: 'variable "region" {}',
    dateSaved: '2024-03-10T08:00:00Z',
    modifiedByName: 'Diana Prince',
    tag: 'release-tag',
    taggedByName: 'Eve Walker',
    dateTagged: '2024-03-11T08:00:00Z',
  },
];

function versionQueryProvider(versions: FileVersion[]) {
  return {
    provide: FileVersionQuery,
    useValue: {
      selectAll: () => of(versions),
      select: () => of(null),
      selectEntity: () => of(null),
      getAll: () => versions,
      getEntity: () => null,
    },
  };
}

const sharedImports = [
  FormsModule,
  MatCardModule,
  MatIconModule,
  MatInputModule,
  MatButtonModule,
  SharedModule,
];

async function renderVersionList(
  overrides: {
    fileId?: string;
    versions?: FileVersion[];
  } = {}
) {
  const versions = overrides.versions ?? mockVersions;
  return renderComponent(VersionListComponent, {
    declarations: [VersionListComponent],
    imports: sharedImports,
    providers: [versionQueryProvider(versions)],
    componentProperties: {
      fileId: overrides.fileId ?? 'f1',
    } as any,
  });
}

describe('VersionListComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderVersionList();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display version cards', async () => {
    await renderVersionList();

    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Charlie Brown/)).toBeInTheDocument();
    expect(screen.getByText(/Diana Prince/)).toBeInTheDocument();
  });

  it('should show FILE VERSIONS heading', async () => {
    await renderVersionList();

    expect(screen.getByText('FILE VERSIONS')).toBeInTheDocument();
  });

  it('should filter versions by name', async () => {
    const { container } = await renderVersionList();

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Alice');

    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.queryByText(/Charlie Brown/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Diana Prince/)).not.toBeInTheDocument();
  });

  it('should filter versions case-insensitively', async () => {
    const { container } = await renderVersionList();

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'charlie');

    expect(screen.getByText(/Charlie Brown/)).toBeInTheDocument();
    expect(screen.queryByText(/Alice Smith/)).not.toBeInTheDocument();
  });

  it('should filter versions by tag', async () => {
    const { container } = await renderVersionList();

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'release-tag');

    expect(screen.getByText(/Diana Prince/)).toBeInTheDocument();
    expect(screen.queryByText(/Alice Smith/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Charlie Brown/)).not.toBeInTheDocument();
  });

  it('should show no versions when filter has no match', async () => {
    const { container } = await renderVersionList();

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'zzz_no_match');

    expect(screen.queryByText(/Alice Smith/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Charlie Brown/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Diana Prince/)).not.toBeInTheDocument();
  });

  it('should clear search and restore all versions', async () => {
    const { container } = await renderVersionList();

    const input = container.querySelector(
      'input[placeholder="Search"]'
    ) as HTMLInputElement;
    await userEvent.type(input, 'Alice');
    expect(screen.queryByText(/Charlie Brown/)).not.toBeInTheDocument();

    const clearButton = container.querySelector(
      'button[aria-label="Clear"]'
    ) as HTMLButtonElement;
    await userEvent.click(clearButton);

    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Charlie Brown/)).toBeInTheDocument();
    expect(screen.getByText(/Diana Prince/)).toBeInTheDocument();
  });

  it('should show Revert button for each version', async () => {
    const { container } = await renderVersionList();

    const revertButtons = container.querySelectorAll('button');
    const revertTexts = Array.from(revertButtons).filter(
      (b) => b.textContent?.trim() === 'Revert'
    );
    expect(revertTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('should show no saved versions message when empty', async () => {
    await renderVersionList({ versions: [] });

    expect(screen.getByText(/No saved versions/)).toBeInTheDocument();
  });

  it('should show tag info when version has a tag', async () => {
    await renderVersionList();

    expect(screen.getByText(/v1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/release-tag/)).toBeInTheDocument();
  });
});

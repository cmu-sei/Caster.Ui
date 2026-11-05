// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  ImportProjectResult,
  ProjectsService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectObjectType } from '../../../state/project.model';
import { ProjectImportComponent } from './project-import.component';

async function renderImport(result: ImportProjectResult) {
  const projectsApi = {
    importProject: vi.fn(() => of<ImportProjectResult>(result)),
  } satisfies ApiStub<ProjectsService>;
  const importComplete = vi.fn<(done: boolean) => void>();
  const { dialogRef } = dialogRefStub<ProjectImportComponent>();
  const view = await renderComponent(ProjectImportComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      A11yModule,
      MatButtonModule,
      MatFormFieldModule,
      MatSlideToggleModule,
      MatTooltipModule,
    ],
    providers: [
      { provide: ProjectsService, useValue: projectsApi },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
    inputs: { id: 'p1', name: 'Range', type: ProjectObjectType.PROJECT },
    on: { importComplete },
  });
  const user = userEvent.setup();
  const archive = new File(['zip'], 'range.zip', { type: 'application/zip' });
  const upload = () =>
    user.upload(
      view.container.querySelector('input[type="file"]') as HTMLInputElement,
      archive,
    );
  return { ...view, projectsApi, importComplete, upload, archive, user };
}

describe('ProjectImportComponent', () => {
  /**
   * Verifies: Import stays disabled until an archive is chosen, then imports it and reports success.
   * Interacts with: ProjectsService.importProject (stub), real ProjectService.
   * Data: archive range.zip; Preserve Ids off; no locked files.
   */
  it('imports the chosen archive and reports success', async () => {
    const { projectsApi, upload, archive, user } = await renderImport({
      lockedFiles: [],
    });

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    await upload();
    expect(screen.getByText('range.zip')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(projectsApi.importProject).toHaveBeenCalledWith(
      'p1',
      false,
      archive,
    );
    expect(screen.getByText('Import Successful')).toBeInTheDocument();
  });

  /**
   * Verifies: files the import could not update because they are locked are listed, and OK completes the dialog.
   * Interacts with: ProjectsService.importProject (stub), the importComplete output.
   * Data: locked file main.tf.
   */
  it('lists locked files after an import', async () => {
    const { importComplete, upload, user } = await renderImport({
      lockedFiles: ['main.tf'],
    });

    await upload();
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Error: The following files are locked',
    );
    expect(screen.getByRole('listitem')).toHaveTextContent('main.tf');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(importComplete).toHaveBeenCalledWith(false);
  });

  /**
   * Verifies: after an import the archive's VM templates and ISOs are listed
   *   with missing ones first and counted, alongside the archive's warnings and
   *   skipped settings.
   * Interacts with: ProjectsService.importProject (stub).
   * Data: a found template, a missing ISO and an unchecked template; one
   *   warning; one skipped setting.
   */
  it('lists the disks the archive needs, missing first', async () => {
    const { upload, user } = await renderImport({
      lockedFiles: [],
      skippedSettings: ['Terraform version 0.11.0 is not available'],
      warnings: ['Ignored __MACOSX/main.tf'],
      disks: [
        {
          kind: 'VmTemplate',
          name: 'ubuntu-2204',
          status: 'Present',
          referencedBy: ['main.tf'],
        },
        {
          kind: 'Iso',
          name: 'local:iso/kali.iso',
          status: 'Missing',
          referencedBy: ['main.tf'],
        },
        {
          kind: 'VmTemplate',
          name: 'win2019',
          status: 'Unknown',
          referencedBy: [],
        },
      ],
    });

    await upload();
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByText('Import Successful')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '1 not found on this system.',
    );
    const items = screen.getAllByRole('listitem').map((x) => x.textContent);
    expect(items).toEqual([
      expect.stringContaining('Terraform version 0.11.0 is not available'),
      expect.stringContaining('Ignored __MACOSX/main.tf'),
      expect.stringMatching(/Missing\s*ISO:\s*local:iso\/kali\.iso/),
      expect.stringMatching(/Not checked\s*VM template:\s*win2019/),
      expect.stringMatching(/Found\s*VM template:\s*ubuntu-2204/),
    ]);
  });
});

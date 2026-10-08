// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { A11yModule } from '@angular/cdk/a11y';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { ProjectsService } from 'src/app/generated/caster-api';
import FileDownloadUtils from 'src/app/shared/utilities/file-download-utils';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { downloadResponse } from 'src/app/test-utils/download-response';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectObjectType } from '../../../state/project.model';
import { ProjectExportComponent } from './project-export.component';

async function renderExport(type: ProjectObjectType) {
  const projectsApi = {
    exportProject: vi.fn(() => of(downloadResponse('range.zip'))),
  } satisfies ApiStub<ProjectsService>;
  const download = vi
    .spyOn(FileDownloadUtils, 'downloadFile')
    .mockImplementation(() => {});
  const exportComplete = vi.fn<(done: boolean) => void>();
  const { dialogRef } = dialogRefStub<ProjectExportComponent>();
  const view = await renderComponent(ProjectExportComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      A11yModule,
      MatFormFieldModule,
      MatSelectModule,
      MatSlideToggleModule,
      MatTooltipModule,
    ],
    providers: [
      { provide: ProjectsService, useValue: projectsApi },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
    inputs: { id: 'p1', name: 'Range', type },
    on: { exportComplete },
  });
  return {
    ...view,
    projectsApi,
    download,
    exportComplete,
    user: userEvent.setup(),
  };
}

describe('ProjectExportComponent', () => {
  /**
   * Verifies: exporting a project requests the archive with the chosen options, downloads it under the server's file name, and completes.
   * Interacts with: ProjectsService.exportProject (stub, observe 'response'), FileDownloadUtils.downloadFile (spied), the exportComplete output.
   * Data: project Range; default archive type (the Zip key); Include Ids switched on.
   */
  it('exports and downloads the project archive', async () => {
    const { projectsApi, download, exportComplete, user } = await renderExport(
      ProjectObjectType.PROJECT,
    );

    expect(
      screen.getByRole('heading', { name: 'Export Project: Range' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Export' }));

    expect(projectsApi.exportProject).toHaveBeenCalledWith(
      'p1',
      'Zip',
      true,
      'response',
    );
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'range.zip');
    expect(exportComplete).toHaveBeenCalledWith(true);
  });

  /**
   * Verifies: a file export offers no archive type, and Cancel completes without exporting.
   * Interacts with: the isArchiveable flag set by the type input, the exportComplete output.
   * Data: type File.
   */
  it('omits the archive type for a file and cancels', async () => {
    const { projectsApi, exportComplete, user } = await renderExport(
      ProjectObjectType.FILE,
    );

    expect(
      screen.queryByRole('combobox', { name: 'Archive Type' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(exportComplete).toHaveBeenCalledWith(false);
    expect(projectsApi.exportProject).not.toHaveBeenCalled();
  });
});

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
import {
  DiskManifest,
  ProjectsService,
  SystemPermission,
} from 'src/app/generated/caster-api';
import FileDownloadUtils from 'src/app/shared/utilities/file-download-utils';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { downloadResponse } from 'src/app/test-utils/download-response';
import { permissionDataProviders } from 'src/app/test-utils/mock-permission-data.service';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectObjectType } from '../../../state/project.model';
import { ProjectExportComponent } from './project-export.component';

const manifest: DiskManifest = {
  schemaVersion: 1,
  disks: [
    {
      kind: 'VmTemplate',
      name: 'ubuntu-2204',
      connection: 'pve',
      referencedBy: ['main.tf'],
    },
    {
      kind: 'Iso',
      name: 'local:iso/kali.iso',
      connection: 'pve',
      referencedBy: ['main.tf'],
    },
  ],
  warnings: ["Networks on connection 'vsphere' could not be read."],
};

async function renderExport(
  type: ProjectObjectType,
  system: SystemPermission[] = [],
) {
  const projectsApi = {
    exportProject: vi.fn(() => of(downloadResponse('range.zip'))),
    getProjectDiskManifest: vi.fn(() => of(structuredClone(manifest))),
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
      ...permissionDataProviders({ system }),
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
      undefined,
      false,
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

  /**
   * Verifies: without ViewHosts the dialog offers no disk manifest.
   * Interacts with: PermissionService.hasPermission over stubbed permissions.
   * Data: project Range; no system permissions.
   */
  it('hides Include Disk Manifest without ViewHosts', async () => {
    await renderExport(ProjectObjectType.PROJECT);

    expect(
      screen.queryByRole('switch', { name: 'Include Disk Manifest' }),
    ).not.toBeInTheDocument();
  });

  /**
   * Verifies: with ViewHosts, switching Include Disk Manifest on previews the
   *   VM templates, ISOs and warnings once, and the export asks for the manifest.
   * Interacts with: ProjectsService.getProjectDiskManifest and exportProject
   *   (stubs); PermissionService over stubbed permissions.
   * Data: project Range; ViewHosts; a manifest with template ubuntu-2204, ISO
   *   local:iso/kali.iso and one warning; the switch is turned on, off, on.
   */
  it('previews and exports the disk manifest for a ViewHosts holder', async () => {
    const { projectsApi, user } = await renderExport(
      ProjectObjectType.PROJECT,
      [SystemPermission.ViewHosts],
    );

    const toggle = screen.getByRole('switch', {
      name: 'Include Disk Manifest',
    });
    await user.click(toggle);

    expect(projectsApi.getProjectDiskManifest).toHaveBeenCalledWith('p1');
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('VM template: ubuntu-2204 (pve)');
    expect(items[1]).toHaveTextContent('ISO: local:iso/kali.iso (pve)');
    expect(
      screen.getByText("Networks on connection 'vsphere' could not be read."),
    ).toBeInTheDocument();

    await user.click(toggle);
    await user.click(toggle);
    expect(projectsApi.getProjectDiskManifest).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(projectsApi.exportProject).toHaveBeenCalledWith(
      'p1',
      'Zip',
      false,
      undefined,
      true,
      'response',
    );
  });

  /**
   * Verifies: a file export never offers a disk manifest, even with ViewHosts.
   * Interacts with: the isArchiveable flag set by the type input.
   * Data: type File; ViewHosts.
   */
  it('offers no disk manifest for a file', async () => {
    await renderExport(ProjectObjectType.FILE, [SystemPermission.ViewHosts]);

    expect(
      screen.queryByRole('switch', { name: 'Include Disk Manifest' }),
    ).not.toBeInTheDocument();
  });
});

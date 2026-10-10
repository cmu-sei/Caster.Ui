// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { A11yModule } from '@angular/cdk/a11y';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import {
  ResourceCommandResult,
  ResourcesService,
} from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ImportResourceComponent } from './import-resource.component';

@Component({ selector: 'cas-output', template: '', standalone: false })
class OutputStub {
  @Input() loading: boolean;
  @Input() output: string;
}

async function renderImport(result: ResourceCommandResult) {
  const resourcesApi = {
    importResources: vi.fn(() => of<ResourceCommandResult>(result)),
  } satisfies ApiStub<ResourcesService>;
  const { dialogRef } = dialogRefStub<ImportResourceComponent>();
  const view = await renderComponent(ImportResourceComponent, {
    declarations: [OutputStub],
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      A11yModule,
      MatFormFieldModule,
      MatInputModule,
      MatTooltipModule,
    ],
    providers: [
      { provide: ResourcesService, useValue: resourcesApi },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
    inputs: { workspaceId: 'w1', loading: false },
  });
  const user = userEvent.setup();
  const fillAndImport = async () => {
    await user.type(
      screen.getByRole('textbox', { name: 'Address' }),
      'aws_instance.web',
    );
    await user.type(screen.getByRole('textbox', { name: 'Id' }), 'i-123');
    await user.click(screen.getByRole('button', { name: 'Import' }));
  };
  const output = (): OutputStub =>
    view.fixture.debugElement.query(By.directive(OutputStub)).componentInstance;
  return { ...view, resourcesApi, fillAndImport, output };
}

describe('ImportResourceComponent', () => {
  /**
   * Verifies: Import sends the address and id for the workspace and shows a success line in the output.
   * Interacts with: ResourcesService.importResources (stub), real WorkspaceService, the cas-output stub.
   * Data: address aws_instance.web, id i-123; no errors.
   */
  it('imports a resource and reports success', async () => {
    const { resourcesApi, fillAndImport, output } = await renderImport({
      resources: [],
      errors: [],
    });

    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    await fillAndImport();

    expect(resourcesApi.importResources).toHaveBeenCalledWith('w1', {
      resourceAddress: 'aws_instance.web',
      resourceId: 'i-123',
    });
    expect(output().output).toBe(
      '\u001b[32;1mSuccess\u001b[0m: imported aws_instance.web',
    );
  });

  /**
   * Verifies: errors returned by the import are written to the output, one per line.
   * Interacts with: ResourcesService.importResources (stub), the cas-output stub.
   * Data: errors "not found" and "bad id".
   */
  it('shows the import errors', async () => {
    const { fillAndImport, output } = await renderImport({
      resources: [],
      errors: ['not found', 'bad id'],
    });

    await fillAndImport();

    expect(output().output).toBe('not found\nbad id\n');
  });
});

// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CRUCIBLE_DIALOG_IMPORTS } from '@cmusei/crucible-common';
import { of, throwError } from 'rxjs';
import { AiDesignDraft, Design, DesignsService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AiDesignDraftDialogComponent } from './ai-design-draft-dialog.component';

// A network module the model filled in, and a VM module whose required image it left out.
const DRAFT: AiDesignDraft = {
  designName: 'Small office',
  summary: 'One network and a workstation.',
  warnings: ['Dropped a module that is not in the catalog: pfsense'],
  snippet: 'module "office_net" {}',
  modules: [
    {
      moduleId: 'mod-net', moduleName: 'vsphere-network', moduleVersion: '1.2.0', name: 'office_net',
      purpose: 'The office LAN', values: [{ name: 'cidr', value: '10.0.0.0/24' }, { name: 'vlan', value: '' }],
      missingRequiredVariables: [],
    },
    {
      moduleId: 'mod-vm', moduleName: 'vsphere-vm', moduleVersion: '2.0.1', name: 'ws1',
      purpose: 'A workstation', values: [{ name: 'network', value: 'module.office_net.id' }],
      missingRequiredVariables: ['image'],
    },
  ],
};

async function renderDraftDialog(designsApi: ApiStub<DesignsService>) {
  const { dialogRef, close } = dialogRefStub<AiDesignDraftDialogComponent>();
  const view = await renderComponent(AiDesignDraftDialogComponent, {
    imports: [
      ...CRUCIBLE_DIALOG_IMPORTS,
      FormsModule,
      MatButtonModule,
      MatCardModule,
      MatExpansionModule,
      MatFormFieldModule,
      MatIconModule,
      MatInputModule,
      MatTooltipModule,
    ],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: { directoryId: 'dir-1', directoryName: 'Range' } },
      { provide: DesignsService, useValue: designsApi },
    ],
  });
  return { ...view, close, user: userEvent.setup() };
}

function stubApi(draft: AiDesignDraft = DRAFT) {
  return {
    draftDesignWithAi: vi.fn((_directoryId: string) => of(structuredClone(draft))),
    createDesignFromAiDraft: vi.fn((_directoryId: string) => of<Design>({ id: 'design-1', name: 'Small office', enabled: false })),
  } satisfies ApiStub<DesignsService>;
}

async function draft(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Describe the environment' }), 'A small office');
  await user.click(screen.getByRole('button', { name: 'Draft' }));
}

describe('AiDesignDraftDialogComponent', () => {
  /**
   * Verifies: Draft waits for a prompt, sends it for the directory, then shows the draft's name, warnings,
   * and a blank required row for the variable the model left out, which blocks Create.
   * Interacts with: DesignsService.draftDesignWithAi, toRow, reviewProblems.
   * Data: prompt "A small office"; DRAFT with ws1 missing image.
   */
  it('drafts from the prompt and asks for what the draft left out', async () => {
    const api = stubApi();
    const { user } = await renderDraftDialog(api);

    expect(screen.getByRole('button', { name: 'Draft' })).toBeDisabled();
    await draft(user);

    expect(api.draftDesignWithAi).toHaveBeenCalledWith('dir-1', { prompt: 'A small office', designName: null });
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Small office');
    expect(screen.getByText('Dropped a module that is not in the catalog: pfsense')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'image (required)' })).toHaveValue('');
    expect(screen.getByText('ws1 needs image.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Design' })).toBeDisabled();
  });

  /**
   * Verifies: filling the missing value enables Create, which sends the edited modules, leaves out a blank
   * optional value, and closes with the new Design.
   * Interacts with: createDesign, MatDialogRef.close (dialogRefStub).
   * Data: image = "win11"; office_net's vlan left blank.
   */
  it('creates the reviewed design', async () => {
    const api = stubApi();
    const { user, close } = await renderDraftDialog(api);
    await draft(user);

    await user.type(screen.getByRole('textbox', { name: 'image (required)' }), 'win11');
    await user.click(screen.getByRole('button', { name: 'Create Design' }));

    expect(api.createDesignFromAiDraft).toHaveBeenCalledWith('dir-1', {
      name: 'Small office',
      modules: [
        { moduleId: 'mod-net', name: 'office_net', moduleVersion: '1.2.0', values: [{ name: 'cidr', value: '10.0.0.0/24' }] },
        {
          moduleId: 'mod-vm', name: 'ws1', moduleVersion: '2.0.1',
          values: [{ name: 'network', value: 'module.office_net.id' }, { name: 'image', value: 'win11' }],
        },
      ],
    });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 'design-1' }));
  });

  /**
   * Verifies: module names follow the Terraform rule and must be unique; removing a module drops its problems.
   * Interacts with: nameProblem, removeModule.
   * Data: ws1 renamed to "office_net", then to "1ws"; then ws1's module removed.
   */
  it('checks module names and lets a module be removed', async () => {
    const { user } = await renderDraftDialog(stubApi());
    await draft(user);
    const names = screen.getAllByRole('textbox', { name: 'Name' });

    await user.clear(names[1]);
    await user.type(names[1], 'office_net');
    expect(screen.getAllByText('Another module has this name').length).toBe(2);

    await user.clear(names[1]);
    await user.type(names[1], '1ws');
    expect(screen.getByText(/^Start with a letter or underscore/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove 1ws' }));
    expect(screen.getAllByRole('textbox', { name: 'Name' }).length).toBe(1);
    expect(screen.getByRole('button', { name: 'Create Design' })).toBeEnabled();
  });

  /**
   * Verifies: an API error shows in the dialog, which stays open on the prompt so it can be changed.
   * Interacts with: errorText, crucible-dialog errorMessage.
   * Data: draftDesignWithAi answers 409 "AI drafting is not enabled on this server."
   */
  it('shows the API error and stays open', async () => {
    const api = stubApi();
    api.draftDesignWithAi.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, statusText: 'Conflict', error: { title: 'AI drafting is not enabled on this server.', status: 409 },
    })));
    const { user, close } = await renderDraftDialog(api);

    await draft(user);

    expect(screen.getByRole('alert')).toHaveTextContent('AI drafting is not enabled on this server.');
    expect(screen.getByRole('button', { name: 'Draft' })).toBeEnabled();
    expect(close).not.toHaveBeenCalled();
  });
});

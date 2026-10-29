// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CRUCIBLE_DIALOG_IMPORTS, Theme } from '@cmusei/crucible-common';
import { DiffEditorComponent, EditorComponent } from 'ngx-monaco-editor-v2';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AiTerraformDraft, FilesService } from 'src/app/generated/caster-api';
import { CurrentUserQuery } from 'src/app/users/state';
import { dialogRefStub } from 'src/app/test-utils/dialog-refs';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AiTerraformDraftDialogComponent, AiTerraformDraftDialogData } from './ai-terraform-draft-dialog.component';

// Monaco cannot load in jsdom; the stubs keep what each editor is given
@Component({ selector: 'ngx-monaco-diff-editor', template: '' })
class DiffEditorStub {
  readonly options = input<any>();
  readonly originalModel = input<any>();
  readonly modifiedModel = input<any>();
}
@Component({ selector: 'ngx-monaco-editor', template: '' })
class EditorStub {
  readonly options = input<any>();
  readonly model = input<any>();
}

// main.tf replaced, network.tf new, and a warning about a declaration
const DRAFT: AiTerraformDraft = {
  summary: 'Adds an attacker VM on the red network.',
  warnings: ['variable "node" is declared more than once (main.tf, range/provider.tf); the plan will fail.'],
  files: [
    { name: 'main.tf', purpose: 'The VMs', content: 'module "kali" {}\n', existingFileId: 'file-1', existingContent: '# empty\n', existingContentHash: 'HASH1' },
    { name: 'network.tf', purpose: 'The red network', content: 'resource "proxmox_network" "red" {}\n' },
  ],
};

async function renderDialog(
  data: AiTerraformDraftDialogData = { directoryId: 'dir-1', directoryName: 'Range' },
  api: Partial<Record<keyof FilesService, any>> = {},
  theme = new BehaviorSubject<Theme>(Theme.LIGHT)
) {
  const { dialogRef, close } = dialogRefStub<AiTerraformDraftDialogComponent>();
  const filesApi = {
    draftTerraformWithAi: vi.fn(() => of(structuredClone(DRAFT))),
    applyAiTerraformDraft: vi.fn(() => of([{ id: 'file-1', name: 'main.tf' }, { id: 'file-2', name: 'network.tf' }])),
    ...api,
  };
  const view = await renderComponent(AiTerraformDraftDialogComponent, {
    imports: [...CRUCIBLE_DIALOG_IMPORTS],
    childStubs: [
      { replace: DiffEditorComponent, with: DiffEditorStub },
      { replace: EditorComponent, with: EditorStub },
    ],
    providers: [
      { provide: MatDialogRef, useValue: dialogRef },
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: FilesService, useValue: filesApi },
      { provide: CurrentUserQuery, useValue: { userTheme$: theme } },
    ],
  });
  return { ...view, close, filesApi, theme, user: userEvent.setup() };
}

async function draft(user: ReturnType<typeof userEvent.setup>, label = 'Describe the infrastructure') {
  await user.type(screen.getByRole('textbox', { name: label }), 'Add an attacker VM');
  await user.click(screen.getByRole('button', { name: 'Draft' }));
}

describe('AiTerraformDraftDialogComponent', () => {
  /**
   * Verifies: the draft shows its summary, warnings and each file, a replaced file as a diff and a new one on its own.
   * Interacts with: FilesService.draftTerraformWithAi, the diff and editor stubs.
   * Data: main.tf replacing "# empty", new network.tf, a duplicate-declaration warning.
   */
  it('drafts the files and shows each for review', async () => {
    const { filesApi, fixture, user } = await renderDialog();

    await draft(user);

    expect(filesApi.draftTerraformWithAi).toHaveBeenCalledWith('dir-1', { prompt: 'Add an attacker VM', fileId: null });
    expect(screen.getByText('Adds an attacker VM on the red network.')).toBeInTheDocument();
    expect(screen.getByText(/variable "node" is declared more than once/)).toBeInTheDocument();
    expect(screen.getByText('Replaces')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    for (const name of ['main.tf', 'network.tf']) {
      await user.click(screen.getByText(name));
    }
    const diff = fixture.debugElement.query(By.directive(DiffEditorStub)).componentInstance as DiffEditorStub;
    expect(diff.originalModel()).toEqual({ code: '# empty\n', language: 'hcl' });
    expect(diff.modifiedModel()).toEqual({ code: 'module "kali" {}\n', language: 'hcl' });
    const editor = fixture.debugElement.query(By.directive(EditorStub)).componentInstance as EditorStub;
    expect(editor.model()).toEqual({ value: 'resource "proxmox_network" "red" {}\n', language: 'hcl' });
  });

  /**
   * Verifies: the review says what the draft was checked against in the inventory, the names it did not find there,
   * and the topology the model says the files build.
   * Interacts with: FilesService.draftTerraformWithAi, the grounding panel.
   * Data: a Proxmox inventory without the dmz bridge; a plan of one segment and one machine.
   */
  it('shows the inventory grounding and the topology plan for review', async () => {
    const { user } = await renderDialog(undefined, {
      draftTerraformWithAi: vi.fn(() =>
        of({
          ...structuredClone(DRAFT),
          inventory: {
            checked: true,
            connections: [{ name: 'default', hypervisor: 'Proxmox', lastUpdated: '2026-10-29T14:05:00Z', stale: false, unavailable: [], truncated: false }],
            found: [{ kind: 'Template', name: 'kali-2026', where: 'main.tf', connection: 'default' }],
            unknown: [{ kind: 'Network', name: 'dmz', where: 'network.tf' }],
          },
          topology: { segments: [{ name: 'red', role: 'Attacker', cidr: '10.66.0.0/24' }], machines: [{ name: 'kali', role: 'Attacker', interfaces: [{ segment: 'red' }] }] },
        } satisfies AiTerraformDraft)
      ),
    });

    await draft(user);

    expect(screen.getByRole('heading', { name: 'Infrastructure inventory' })).toBeInTheDocument();
    expect(screen.getByLabelText('In the inventory')).toHaveTextContent('kali-2026');
    expect(screen.getByRole('list', { name: 'Not in the inventory' })).toHaveTextContent('Network dmz is not in the inventory (network.tf)');
    expect(screen.getByText('Topology plan: 1 segment, 1 machine')).toBeInTheDocument();
  });

  /**
   * Verifies: only the kept files are applied, with the hash of what the draft replaced, and the dialog closes with the saved files and their content.
   * Interacts with: the Keep checkboxes, FilesService.applyAiTerraformDraft, dialogRef.close.
   * Data: network.tf unticked; main.tf applied with hash HASH1.
   */
  it('applies the kept files and closes with what was saved', async () => {
    const { filesApi, close, user } = await renderDialog(undefined, {
      applyAiTerraformDraft: vi.fn(() => of([{ id: 'file-1', name: 'main.tf' }])),
    });
    await draft(user);

    await user.click(screen.getByRole('checkbox', { name: 'Keep network.tf' }));
    await user.click(screen.getByRole('button', { name: 'Apply 1 file' }));

    expect(filesApi.applyAiTerraformDraft).toHaveBeenCalledWith('dir-1', {
      files: [{ name: 'main.tf', content: 'module "kali" {}\n', existingFileId: 'file-1', existingContentHash: 'HASH1' }],
    });
    expect(close).toHaveBeenCalledWith([{ id: 'file-1', name: 'main.tf', content: 'module "kali" {}\n', editorContent: 'module "kali" {}\n' }]);
  });

  /**
   * Verifies: a refused apply says why in the API's words and keeps the review open.
   * Interacts with: FilesService.applyAiTerraformDraft erroring with 409.
   * Data: "main.tf has changed since the draft was written. Draft again."
   */
  it('says why the files could not be saved', async () => {
    const { close, user } = await renderDialog(undefined, {
      applyAiTerraformDraft: vi.fn(() =>
        throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'main.tf has changed since the draft was written. Draft again.' } }))
      ),
    });
    await draft(user);

    await user.click(screen.getByRole('button', { name: 'Apply 2 files' }));

    expect(screen.getByRole('alert')).toHaveTextContent('main.tf has changed since the draft was written. Draft again.');
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Apply 2 files' })).toBeEnabled();
  });

  /**
   * Verifies: started from a file, the dialog is about that file and sends its ID with the draft.
   * Interacts with: FilesService.draftTerraformWithAi.
   * Data: file main.tf (file-1) in directory Range.
   */
  it('drafts a change to the open file', async () => {
    const { filesApi, user } = await renderDialog({ directoryId: 'dir-1', directoryName: 'Range', fileId: 'file-1', fileName: 'main.tf' });

    expect(screen.getByText('Edit main.tf with AI')).toBeInTheDocument();
    await draft(user, 'What should change?');

    expect(filesApi.draftTerraformWithAi).toHaveBeenCalledWith('dir-1', { prompt: 'Add an attacker VM', fileId: 'file-1' });
  });

  /**
   * Verifies: the code follows the designer's light or dark theme, as the file editor's does, and changes with it.
   * Interacts with: CurrentUserQuery.userTheme$, the editors' options.
   * Data: light, then dark.
   */
  it('shows the code in the designer\'s theme', async () => {
    const { fixture, theme, user } = await renderDialog();
    await draft(user);
    await user.click(screen.getByText('main.tf'));
    const diff = () => fixture.debugElement.query(By.directive(DiffEditorStub)).componentInstance as DiffEditorStub;

    expect(diff().options().theme).toBe('vs-light');
    theme.next(Theme.DARK);
    fixture.detectChanges();

    expect(diff().options().theme).toBe('vs-dark');
  });
});

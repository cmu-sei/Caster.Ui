// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import {
  Component,
  EventEmitter,
  getDebugNode,
  Input,
  Output,
} from '@angular/core';
import { screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CreateSnippetCommand, Module } from 'src/app/generated/caster-api';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ModuleListComponent } from './module-list.component';
import { ModuleVariablesComponent } from 'src/app/editor/component/module-variables/module-variables.component';

@Component({
  selector: 'cas-module-variables',
  template: '',
})
class ModuleVariablesStub {
  @Input() selectedModule: Module;
  @Input() readOnly: boolean;
  @Input() submitButtonText: string;
  @Input() requireChanges: boolean;
  @Output() variablesSelected = new EventEmitter<CreateSnippetCommand>();
}

const modules: Module[] = [
  { id: 'mod1', name: 'web', path: 'g/web', versionsCount: 2 },
  { id: 'mod2', name: 'db', path: 'g/db', versionsCount: 1 },
  { id: 'mod3', name: 'empty', path: 'g/empty', versionsCount: 0 },
];

async function renderModuleList(isEditing = true) {
  const getModule = vi.fn<(m: { id: string; name: string }) => void>();
  const insertModule = vi.fn<(c: CreateSnippetCommand) => void>();
  const view = await renderComponent(ModuleListComponent, {
    childStubs: [
      { replace: ModuleVariablesComponent, with: ModuleVariablesStub },
    ],
    imports: [
      MatCardModule,
      MatFormFieldModule,
      MatInputModule,
      MatButtonModule,
      MatIconModule,
      MatDialogModule,
      MatTooltipModule,
    ],
    inputs: { modules, isEditing },
    on: { getModule, insertModule },
  });
  return { ...view, getModule, insertModule, user: userEvent.setup() };
}

// The variables dialog renders in the overlay, outside the fixture's debug tree.
function variablesDialog(): ModuleVariablesStub | undefined {
  const element = document.querySelector('cas-module-variables');
  return element ? getDebugNode(element)?.componentInstance : undefined;
}

const selected: Module = {
  id: 'mod2',
  name: 'db',
  path: 'g/db',
  versions: [{ id: 'ver1', name: 'v1' }],
};

describe('ModuleListComponent', () => {
  /**
   * Verifies: modules without versions are left out of the list, and clicking a module asks for it by id and name.
   * Interacts with: the modules input setter, the getModule output.
   * Data: modules web (2 versions), db (1) and empty (0); db clicked.
   */
  it('lists the modules that have versions and selects one', async () => {
    const { getModule, user } = await renderModuleList();

    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.queryByText('empty')).not.toBeInTheDocument();
    await user.click(screen.getByText('db'));

    expect(getModule).toHaveBeenCalledWith({ id: 'mod2', name: 'db' });
  });

  /**
   * Verifies: the search box filters the listed modules.
   * Interacts with: applyFilter() on the MatTableDataSource.
   * Data: search "we".
   */
  it('filters the modules by the search text', async () => {
    const { user } = await renderModuleList();

    await user.type(screen.getByPlaceholderText('Search'), 'we');

    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.queryByText('db')).not.toBeInTheDocument();
  });

  /**
   * Verifies: while the file is not in edit mode each module card says why it cannot be inserted, and in edit mode it carries no such hint.
   * Interacts with: the card's matTooltip binding on the isEditing input.
   * Data: modules web and db; isEditing false, then true.
   */
  it.each([
    { isEditing: false, hint: 'Edit this file to insert the module' },
    { isEditing: true, hint: '' },
  ])(
    'gives the module cards the hint "$hint" when isEditing is $isEditing',
    async ({ isEditing, hint }) => {
      const { fixture } = await renderModuleList(isEditing);
      await fixture.whenStable();

      const card = screen.getByText('web').closest('mat-card');
      expect(card).toHaveAccessibleDescription(hint);
    },
  );

  /**
   * Verifies: a selected module opens the variables dialog for Insert, writable in edit mode and with no change required, and its result is emitted as insertModule and closes the dialog.
   * Interacts with: the selectedModule input setter, the real MatDialog, the module-variables stub's inputs and variablesSelected output, the insertModule output.
   * Data: module db with version v1 selected while the file is in edit mode.
   */
  it('opens the Insert dialog for the selected module and emits the result', async () => {
    const { fixture, insertModule } = await renderModuleList(true);

    fixture.componentRef.setInput('selectedModule', selected);
    fixture.detectChanges();
    await fixture.whenStable();

    const dialog = variablesDialog();
    expect(dialog).toBeDefined();
    expect({
      selectedModule: dialog?.selectedModule,
      readOnly: dialog?.readOnly,
      submitButtonText: dialog?.submitButtonText,
      requireChanges: dialog?.requireChanges,
    }).toEqual({
      selectedModule: selected,
      readOnly: false,
      submitButtonText: 'Insert',
      requireChanges: false,
    });

    const command: CreateSnippetCommand = {
      moduleName: 'db',
      versionId: 'ver1',
      variableValues: [],
    };
    dialog?.variablesSelected.emit(command);
    await fixture.whenStable();

    expect(insertModule).toHaveBeenCalledWith(command);
    expect(document.querySelector('cas-module-variables')).toBeNull();
  });

  /**
   * Verifies: outside edit mode the variables dialog opens read-only.
   * Interacts with: the [readOnly]="!isEditing" binding on the module-variables stub.
   * Data: module db with version v1 selected while the file is not in edit mode.
   */
  it('opens the Insert dialog read-only when isEditing is false', async () => {
    const { fixture } = await renderModuleList(false);

    fixture.componentRef.setInput('selectedModule', selected);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(variablesDialog()?.readOnly).toBe(true);
  });
});

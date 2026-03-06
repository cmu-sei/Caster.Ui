// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ModuleVariablesComponent } from './module-variables.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SharedModule } from 'src/app/shared/shared.module';

const sharedImports = [
  FormsModule,
  ReactiveFormsModule,
  MatCardModule,
  MatIconModule,
  MatInputModule,
  MatButtonModule,
  MatSelectModule,
  MatTooltipModule,
  MatAutocompleteModule,
  SharedModule,
];

async function renderModuleVariables(
  overrides: {
    name?: string;
    selectedModule?: any;
    values?: any[];
    variables?: any[];
    readOnly?: boolean;
  } = {}
) {
  return renderComponent(ModuleVariablesComponent, {
    declarations: [ModuleVariablesComponent],
    imports: sharedImports,
    componentProperties: {
      name: overrides.name ?? 'test-module',
      selectedModule: overrides.selectedModule ?? {
        id: 'm-1',
        name: 'test',
        versions: [{ id: 'v-1', name: '1.0.0', variables: [], outputs: [] }],
      },
      values: overrides.values ?? [],
      variables: overrides.variables ?? [],
      readOnly: overrides.readOnly ?? false,
    } as any,
  });
}

describe('ModuleVariablesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderModuleVariables();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display module name', async () => {
    await renderModuleVariables({
      selectedModule: {
        id: 'm-1',
        name: 'my-module',
        path: 'modules/my',
        description: 'A test module',
        versions: [{ id: 'v-1', name: '1.0.0', variables: [], outputs: [] }],
      },
    });

    expect(screen.getByText('my-module')).toBeInTheDocument();
  });

  it('should display module path', async () => {
    await renderModuleVariables({
      selectedModule: {
        id: 'm-1',
        name: 'my-module',
        path: 'modules/my',
        description: 'A test module',
        versions: [{ id: 'v-1', name: '1.0.0', variables: [], outputs: [] }],
      },
    });

    expect(screen.getByText('modules/my')).toBeInTheDocument();
  });

  it('should display module description', async () => {
    await renderModuleVariables({
      selectedModule: {
        id: 'm-1',
        name: 'my-module',
        path: 'modules/my',
        description: 'A test module',
        versions: [{ id: 'v-1', name: '1.0.0', variables: [], outputs: [] }],
      },
    });

    expect(screen.getByText('A test module')).toBeInTheDocument();
  });

  it('should show Close button when form is pristine', async () => {
    await renderModuleVariables();

    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('should have a submit button', async () => {
    await renderModuleVariables();

    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});

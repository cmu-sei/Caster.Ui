// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ClipboardModule } from 'ngx-clipboard';
import { VariableComponent } from './variable.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SharedModule } from 'src/app/shared/shared.module';

const sharedImports = [
  FormsModule,
  ReactiveFormsModule,
  MatCardModule,
  MatIconModule,
  MatButtonModule,
  MatInputModule,
  MatSelectModule,
  MatTooltipModule,
  MatSnackBarModule,
  ClipboardModule,
  SharedModule,
];

async function renderVariable(
  overrides: {
    variable?: any;
    canEdit?: boolean;
  } = {}
) {
  return renderComponent(VariableComponent, {
    declarations: [VariableComponent],
    imports: sharedImports,
    componentProperties: {
      variable: overrides.variable ?? {
        id: 'v-1',
        name: 'test_var',
        type: 'string',
        defaultValue: '',
      },
      canEdit: overrides.canEdit ?? false,
    } as any,
  });
}

describe('VariableComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderVariable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display variable name', async () => {
    await renderVariable({
      variable: {
        id: 'v-1',
        name: 'my_var',
        type: 'string',
        defaultValue: 'hello',
      },
    });

    expect(screen.getByText('my_var')).toBeInTheDocument();
  });

  it('should have Edit button', async () => {
    const { container } = await renderVariable();

    expect(
      container.querySelector('button[matTooltip="Edit"]')
    ).toBeInTheDocument();
  });

  it('should have Delete button', async () => {
    const { container } = await renderVariable();

    expect(
      container.querySelector('button[matTooltip="Delete"]')
    ).toBeInTheDocument();
  });

  it('should disable Delete when canEdit is false', async () => {
    const { container } = await renderVariable({ canEdit: false });

    const deleteBtn = container.querySelector(
      'button[matTooltip="Delete"]'
    ) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });

  it('should have Copy Terraform button', async () => {
    const { container } = await renderVariable();

    expect(
      container.querySelector('button[matTooltip="Copy Terraform"]')
    ).toBeInTheDocument();
  });
});

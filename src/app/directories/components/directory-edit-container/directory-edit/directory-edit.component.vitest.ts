// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CommonModule } from '@angular/common';
import { DirectoryEditComponent } from './directory-edit.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

const sharedImports = [
  CommonModule,
  FormsModule,
  ReactiveFormsModule,
  MatFormFieldModule,
  MatInputModule,
  MatSelectModule,
  MatOptionModule,
  MatCheckboxModule,
  MatButtonModule,
  MatIconModule,
  MatTooltipModule,
];

describe('DirectoryEditComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(DirectoryEditComponent, {
      declarations: [DirectoryEditComponent],
      imports: sharedImports,
      componentProperties: {
        directory: {
          id: 'd-1',
          name: 'test',
          projectId: 'p-1',
        } as any,
        terraformVersions: {
          versions: [],
          defaultVersion: '',
        } as any,
      } as any,
    });
    expect(fixture.componentInstance).toBeTruthy();
  });
});

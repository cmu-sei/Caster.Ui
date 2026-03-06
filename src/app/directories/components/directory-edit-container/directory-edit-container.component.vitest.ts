// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { DirectoryEditContainerComponent } from './directory-edit-container.component';
import { DirectoryEditComponent } from './directory-edit/directory-edit.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { DirectoryQuery } from 'src/app/directories/state/directory.query';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

const mockDirectory = {
  id: 'test-dir-id',
  name: 'Test Directory',
  projectId: 'p-1',
  terraformVersion: '1.0.0',
  parallelism: 10,
  azureDestroyFailureThreshold: 5,
  azureDestroyFailureThresholdEnabled: false,
};

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

describe('DirectoryEditContainerComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(DirectoryEditContainerComponent, {
      declarations: [DirectoryEditContainerComponent, DirectoryEditComponent],
      imports: sharedImports,
      providers: [
        {
          provide: DirectoryQuery,
          useValue: {
            selectAll: () => of([]),
            select: () => of(null),
            selectEntity: () => of(mockDirectory),
            getAll: () => [],
            getEntity: () => mockDirectory,
            ui: {
              selectEntity: () => of(null),
              selectAll: () => of([]),
            },
          },
        },
      ],
      componentProperties: { id: 'test-dir-id' } as any,
    });
    expect(fixture.componentInstance).toBeTruthy();
  });
});

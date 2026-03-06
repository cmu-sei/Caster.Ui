// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkspaceEditComponent } from './workspace-edit.component';
import { renderComponent } from 'src/app/test-utils/render-component';

const sharedImports = [
  ReactiveFormsModule,
  MatInputModule,
  MatSelectModule,
  MatButtonModule,
  MatIconModule,
  MatTooltipModule,
];

describe('WorkspaceEditComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(WorkspaceEditComponent, {
      declarations: [WorkspaceEditComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: {
        workspace: { id: 'ws-1', name: 'test', directoryId: 'd-1' } as any,
        terraformVersions: { versions: [], defaultVersion: '' } as any,
      },
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display Edit Workspace heading', async () => {
    const { fixture } = await renderComponent(WorkspaceEditComponent, {
      declarations: [WorkspaceEditComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: {
        workspace: { id: 'ws-1', name: 'test', directoryId: 'd-1' } as any,
        terraformVersions: { versions: [], defaultVersion: '' } as any,
      },
    });
    const heading = fixture.nativeElement.querySelector('h2');
    expect(heading?.textContent).toContain('Edit Workspace');
  });

  it('should have Save and Cancel buttons', async () => {
    const { fixture } = await renderComponent(WorkspaceEditComponent, {
      declarations: [WorkspaceEditComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: {
        workspace: { id: 'ws-1', name: 'test', directoryId: 'd-1' } as any,
        terraformVersions: { versions: [], defaultVersion: '' } as any,
      },
    });
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b: any) => b.textContent.trim());
    expect(buttonTexts.some((t: string) => t.includes('Save'))).toBe(true);
    expect(buttonTexts.some((t: string) => t.includes('Cancel'))).toBe(true);
  });

  it('should initialize form with workspace name', async () => {
    const { fixture } = await renderComponent(WorkspaceEditComponent, {
      declarations: [WorkspaceEditComponent],
      imports: sharedImports,
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: {
        workspace: { id: 'ws-1', name: 'my-workspace', directoryId: 'd-1' } as any,
        terraformVersions: { versions: [], defaultVersion: '' } as any,
      },
    });
    expect(fixture.componentInstance.form.get('name')?.value).toBe('my-workspace');
  });
});

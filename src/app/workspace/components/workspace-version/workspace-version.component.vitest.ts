// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkspaceVersionComponent } from './workspace-version.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('WorkspaceVersionComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(WorkspaceVersionComponent, {
      declarations: [WorkspaceVersionComponent],
      imports: [MatTooltipModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: {
        workspace: { id: 'ws-1', name: 'test', terraformVersion: '1.5.0' } as any,
      },
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the terraform version', async () => {
    const { fixture } = await renderComponent(WorkspaceVersionComponent, {
      declarations: [WorkspaceVersionComponent],
      imports: [MatTooltipModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: {
        workspace: { id: 'ws-1', name: 'test', terraformVersion: '1.5.0' } as any,
      },
    });
    expect(fixture.nativeElement.textContent).toContain('1.5.0');
  });
});

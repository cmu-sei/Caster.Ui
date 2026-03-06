// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { WorkspaceEditContainerComponent } from './workspace-edit-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';

describe('WorkspaceEditContainerComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(WorkspaceEditContainerComponent, {
      declarations: [WorkspaceEditContainerComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: { id: 'test-ws-id' },
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have the provided id', async () => {
    const { fixture } = await renderComponent(WorkspaceEditContainerComponent, {
      declarations: [WorkspaceEditContainerComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      componentProperties: { id: 'test-ws-id' },
    });
    expect(fixture.componentInstance.id).toBe('test-ws-id');
  });
});

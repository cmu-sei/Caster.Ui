// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ProjectListContainerComponent } from './project-list-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { MatDialogModule } from '@angular/material/dialog';

describe('ProjectListContainerComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(
      ProjectListContainerComponent,
      {
        declarations: [ProjectListContainerComponent],
        imports: [MatDialogModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      }
    );
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should set titleText from settings', async () => {
    const { fixture } = await renderComponent(
      ProjectListContainerComponent,
      {
        declarations: [ProjectListContainerComponent],
        imports: [MatDialogModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      }
    );
    expect(fixture.componentInstance.titleText).toBe('Caster');
  });
});

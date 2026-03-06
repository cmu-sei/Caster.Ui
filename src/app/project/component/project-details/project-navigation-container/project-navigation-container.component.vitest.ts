// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ProjectNavigationContainerComponent } from './project-navigation-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { RouterQuery } from '@datorama/akita-ng-router-store';
import { ProjectStore } from '../../../state';

describe('ProjectNavigationContainerComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(
      ProjectNavigationContainerComponent,
      {
        declarations: [ProjectNavigationContainerComponent],
        imports: [CommonModule, MatDialogModule, MatIconModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          {
            provide: RouterQuery,
            useValue: {
              select: () =>
                of({ params: { id: 'p-1' }, queryParams: {} }),
              selectParams: () => of({ id: 'p-1' }),
            },
          },
          {
            provide: ProjectStore,
            useValue: {
              setActive: () => {},
              ui: { setActive: () => {} },
            },
          },
        ],
      }
    );
    expect(fixture.componentInstance).toBeTruthy();
  });
});

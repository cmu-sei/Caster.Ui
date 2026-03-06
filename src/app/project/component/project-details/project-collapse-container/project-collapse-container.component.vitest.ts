// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { ProjectCollapseContainerComponent } from './project-collapse-container.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ComnAuthQuery } from '@cmusei/crucible-common';
import { ResizableModule } from 'angular-resizable-element';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { ProjectQuery } from '../../../state';

describe('ProjectCollapseContainerComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(
      ProjectCollapseContainerComponent,
      {
        declarations: [ProjectCollapseContainerComponent],
        imports: [ResizableModule, MatSidenavModule, MatIconModule],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
        providers: [
          {
            provide: ComnAuthQuery,
            useValue: {
              select: () => of(null),
              isAuthenticated$: of(true),
              user$: of({}),
            },
          },
          {
            provide: ProjectQuery,
            useValue: {
              selectActive: () => of(undefined),
              selectLoading: () => of(false),
              ui: {
                selectActive: () => of(null),
                selectEntity: () => of(null),
                selectAll: () => of([]),
              },
              getLeftSidebarOpen: () => of(true),
              getLeftSidebarWidth: () => of(300),
              getActive: () => ({ id: 'p-1' }),
              selectAll: () => of([]),
              select: () => of(null),
              selectEntity: () => of(null),
              selectSelectedTab: () => of(0),
              selectOpenTabs: () => of([]),
              getEntity: () => null,
              getAll: () => [],
              getRightSidebarOpen$: () => of(false),
              getRightSidebarView$: () => of(''),
              getRightSidebarWidth: () => of(300),
            },
          },
        ],
      }
    );
    expect(fixture.componentInstance).toBeTruthy();
  });
});

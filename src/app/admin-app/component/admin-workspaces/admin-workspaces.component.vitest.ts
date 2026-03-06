// Copyright 2024 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect } from 'vitest';
import { AdminWorkspacesComponent } from './admin-workspaces.component';
import { renderComponent } from 'src/app/test-utils/render-component';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { WorkspaceQuery } from 'src/app/workspace/state/workspace.query';
import { of } from 'rxjs';

describe('AdminWorkspacesComponent', () => {
  it('should create', async () => {
    const { fixture } = await renderComponent(AdminWorkspacesComponent, {
      declarations: [AdminWorkspacesComponent],
      providers: [
        {
          provide: SignalRService,
          useValue: {
            startConnection: () => Promise.resolve(),
            joinWorkspacesAdmin: () => {},
            leaveWorkspacesAdmin: () => {},
            joinProject: () => {},
            leaveProject: () => {},
            joinWorkspace: () => {},
            leaveWorkspace: () => {},
          },
        },
        {
          provide: WorkspaceQuery,
          useValue: {
            selectAll: () => of([]),
            select: () => of({ lockingEnabled: false }),
            selectEntity: () => of(null),
            selectLoading: () => of(false),
            getAll: () => [],
            getEntity: () => null,
            activeRuns$: () => of([]),
            expandedRuns$: () => of([]),
          },
        },
      ],
    });

    expect(fixture.componentInstance).toBeTruthy();
  });
});

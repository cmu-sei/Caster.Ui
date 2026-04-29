// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { ProjectQuery } from 'src/app/project/state/project-query.service';
import { PermissionService } from 'src/app/permissions/permission.service';
import { SignalRService } from 'src/app/shared/signalr/signalr.service';
import { VlansComponent } from './vlans.component';
import { renderComponent } from 'src/app/test-utils/render-component';

async function renderVlans() {
  const startConnection = vi.fn(() => Promise.resolve());
  const joinVlansAdmin = vi.fn();
  const leaveVlansAdmin = vi.fn();
  const rendered = await renderComponent(VlansComponent, {
    declarations: [VlansComponent],
    schemas: [NO_ERRORS_SCHEMA],
    providers: [
      { provide: ProjectQuery, useValue: { selectAll: () => of([]) } },
      { provide: PermissionService, useValue: { hasPermission: () => of(true) } },
      {
        provide: SignalRService,
        useValue: { startConnection, joinVlansAdmin, leaveVlansAdmin },
      },
    ],
  });
  return { ...rendered, startConnection, joinVlansAdmin, leaveVlansAdmin };
}

describe('VlansComponent', () => {
  it('creates and starts a SignalR connection on init', async () => {
    const { fixture, startConnection } = await renderVlans();
    expect(fixture.componentInstance).toBeTruthy();
    expect(startConnection).toHaveBeenCalled();
    await Promise.resolve();
  });

  it('leaves the vlans admin channel on destroy', async () => {
    const { fixture, leaveVlansAdmin } = await renderVlans();
    fixture.componentInstance.ngOnDestroy();
    expect(leaveVlansAdmin).toHaveBeenCalled();
  });
});

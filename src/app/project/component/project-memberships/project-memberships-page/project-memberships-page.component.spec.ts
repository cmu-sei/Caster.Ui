// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, Input } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import {
  ProjectPermissionsClaim,
  ProjectPermissionsService,
} from 'src/app/generated/caster-api';
import { activatedRouteStub } from 'src/app/test-utils/activated-route';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { ProjectMembershipsPageComponent } from './project-memberships-page.component';

@Component({ selector: 'cas-topbar', template: '', standalone: false })
class TopbarStub {}

@Component({
  selector: 'cas-project-memberships',
  template: '',
  standalone: false,
})
class ProjectMembershipsStub {
  @Input() projectId: string;
  @Input() showReturnButton: boolean;
}

describe('ProjectMembershipsPageComponent', () => {
  /**
   * Verifies: the page reads the project id from the route, loads that project's permission claims, and shows its memberships with the return button.
   * Interacts with: ActivatedRoute (activatedRouteStub), ProjectPermissionsService.getMyProjectPermissions (stub), real PermissionService.
   * Data: route id p1.
   */
  it('shows the memberships of the routed project', async () => {
    const projectPermissionsApi = {
      getMyProjectPermissions: vi.fn((_projectId?: string) =>
        of<ProjectPermissionsClaim[]>([]),
      ),
    } satisfies ApiStub<ProjectPermissionsService>;
    const { fixture } = await renderComponent(ProjectMembershipsPageComponent, {
      declarations: [TopbarStub, ProjectMembershipsStub],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: activatedRouteStub({}, { id: 'p1' }).route,
        },
        { provide: ProjectPermissionsService, useValue: projectPermissionsApi },
      ],
    });

    expect(projectPermissionsApi.getMyProjectPermissions).toHaveBeenCalledWith(
      'p1',
    );
    const memberships: ProjectMembershipsStub = fixture.debugElement.query(
      By.directive(ProjectMembershipsStub),
    ).componentInstance;
    expect(memberships.projectId).toBe('p1');
    expect(memberships.showReturnButton).toBe(true);
  });
});

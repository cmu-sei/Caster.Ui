// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { describe, it, expect, vi } from 'vitest';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { Project, ProjectsService } from 'src/app/generated/caster-api';
import { ApiStub } from 'src/app/test-utils/api-stub';
import { renderComponent } from 'src/app/test-utils/render-component';
import { AdminProjectsComponent } from './admin-projects.component';

@Component({ selector: 'cas-project-list', template: '', standalone: false })
class ProjectListStub {
  @Input() projects: Project[];
  @Input() isLoading: boolean;
  @Input() manageMode: boolean;
  @Output() selectedProjectId = new EventEmitter<string>();
}

@Component({
  selector: 'cas-project-memberships',
  template: '',
  standalone: false,
})
class ProjectMembershipsStub {
  @Input() projectId: string;
  @Input() embedded: boolean;
  @Output() goBack = new EventEmitter<void>();
}

async function renderAdminProjects() {
  const projectsApi = {
    getAllProjects: vi.fn((_onlyMine?: boolean) =>
      of<Project[]>([{ id: 'p1', name: 'Range' }]),
    ),
  } satisfies ApiStub<ProjectsService>;
  const view = await renderComponent(AdminProjectsComponent, {
    declarations: [ProjectListStub, ProjectMembershipsStub],
    providers: [{ provide: ProjectsService, useValue: projectsApi }],
  });
  return { ...view, projectsApi };
}

describe('AdminProjectsComponent', () => {
  /**
   * Verifies: the page loads every project (not only the user's) into a project list in manage mode.
   * Interacts with: ProjectsService.getAllProjects (stub), real ProjectService and ProjectQuery.
   * Data: one project p1.
   */
  it('lists all projects in manage mode', async () => {
    const { fixture, projectsApi } = await renderAdminProjects();

    const list: ProjectListStub = fixture.debugElement.query(
      By.directive(ProjectListStub),
    ).componentInstance;
    expect(projectsApi.getAllProjects).toHaveBeenCalledWith(false);
    expect(list.manageMode).toBe(true);
    expect(list.projects.map((p) => p.id)).toEqual(['p1']);
  });

  /**
   * Verifies: selecting a project swaps the list for that project's memberships, and goBack returns to the list.
   * Interacts with: the list stub's selectedProjectId output and the memberships stub's goBack output.
   * Data: project p1 selected.
   */
  it('shows the memberships of the selected project', async () => {
    const { fixture } = await renderAdminProjects();

    fixture.debugElement
      .query(By.directive(ProjectListStub))
      .componentInstance.selectedProjectId.emit('p1');
    fixture.detectChanges();

    const memberships: ProjectMembershipsStub = fixture.debugElement.query(
      By.directive(ProjectMembershipsStub),
    ).componentInstance;
    expect(memberships.projectId).toBe('p1');
    expect(memberships.embedded).toBe(true);
    expect(
      fixture.debugElement.query(By.directive(ProjectListStub)),
    ).toBeNull();

    memberships.goBack.emit();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.directive(ProjectListStub)),
    ).not.toBeNull();
  });
});

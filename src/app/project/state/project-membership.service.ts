// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  CreateProjectMembershipCommand,
  EditProjectMembershipCommand,
  ProjectMembership,
  ProjectsService,
} from 'src/app/generated/caster-api';

@Injectable({
  providedIn: 'root',
})
export class ProjectMembershipService {
  private projectMembershipsSubject = new BehaviorSubject<ProjectMembership[]>(
    []
  );
  public projectMemberships$ = this.projectMembershipsSubject.asObservable();

  constructor(private projectService: ProjectsService) {}

  loadMemberships(projectId: string): Observable<ProjectMembership[]> {
    return this.projectService
      .getProjectMemberships(projectId)
      .pipe(tap((x) => this.projectMembershipsSubject.next(x)));
  }

  createMembership(projectId: string, command: CreateProjectMembershipCommand) {
    return this.projectService.createProjectMembership(projectId, command).pipe(
      tap((x) => {
        this.upsert(x.id, x);
      })
    );
  }

  editMembership(command: EditProjectMembershipCommand) {
    return this.projectService.editProjectMembership(command).pipe(
      tap((x) => {
        this.upsert(command.id, x);
      })
    );
  }

  deleteMembership(id: string) {
    return this.projectService.deleteProjectMembership(id).pipe(
      tap(() => {
        this.remove(id);
      })
    );
  }

  upsert(id: string, projectMembership: Partial<ProjectMembership>) {
    const memberships = this.projectMembershipsSubject.getValue();
    let membershipToUpdate = memberships.find((x) => x.id === id);

    if (membershipToUpdate != null) {
      Object.assign(membershipToUpdate, projectMembership);
    } else {
      memberships.push({ ...projectMembership, id } as ProjectMembership);
    }

    this.projectMembershipsSubject.next(memberships);
  }

  remove(id: string) {
    let memberships = this.projectMembershipsSubject.getValue();
    memberships = memberships.filter((x) => x.id != id);
    this.projectMembershipsSubject.next(memberships);
  }
}

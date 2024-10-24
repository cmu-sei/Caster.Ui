// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
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

  createMembership(projectId: string, userId: string) {
    return this.projectService
      .createProjectMembership(projectId, {
        userId: userId,
      })
      .pipe(
        tap((x) => {
          const memberships = this.projectMembershipsSubject.getValue();
          memberships.push(x);
          this.projectMembershipsSubject.next(memberships);
        })
      );
  }

  editMembership(projectId: string, command: EditProjectMembershipCommand) {
    return this.projectService.editProjectMembership(projectId, command).pipe(
      tap((x) => {
        const memberships = this.projectMembershipsSubject.getValue();
        const index = memberships.findIndex((m) => m.id === x.id);

        if (index !== -1) {
          memberships[index] = x;
          this.projectMembershipsSubject.next(memberships);
        }
      })
    );
  }

  deleteMembership(projectId: string, userId: string) {
    return this.projectService
      .deleteProjectMembership(projectId, {
        userId: userId,
      })
      .pipe(
        tap(() => {
          let memberships = this.projectMembershipsSubject.getValue();
          memberships = memberships.filter(
            (x) => !(x.projectId == projectId && x.userId == userId)
          );
          this.projectMembershipsSubject.next(memberships);
        })
      );
  }
}

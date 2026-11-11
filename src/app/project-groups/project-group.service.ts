// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import {
  CreateProjectGroupMembershipCommand,
  ProjectGroup,
  ProjectGroupMembership,
  ProjectGroupsService,
} from '../generated/caster-api';

/**
 * The project groups the user can see: every group for ViewProjects and
 * ManageProjectGroups holders, otherwise the groups they're members of.
 */
@Injectable({
  providedIn: 'root',
})
export class ProjectGroupService {
  private api = inject(ProjectGroupsService);

  private groupsSubject = new BehaviorSubject<ProjectGroup[]>([]);
  public groups$ = this.groupsSubject.asObservable();

  private loaded = false;

  load(): Observable<ProjectGroup[]> {
    return this.api.getProjectGroups().pipe(
      tap((x) => {
        this.loaded = true;
        this.groupsSubject.next(x ?? []);
      }),
    );
  }

  /** The groups, read once if nothing has read them yet, then kept current by this service's writes. */
  groupsLoaded$(): Observable<ProjectGroup[]> {
    const read = this.loaded
      ? of(null)
      : this.load().pipe(catchError(() => of(null)));
    return read.pipe(switchMap(() => this.groups$));
  }

  /** Reads one group back, after a change made elsewhere. */
  refresh(id: string): Observable<ProjectGroup> {
    return this.api.getProjectGroup(id).pipe(tap((x) => this.upsert(x)));
  }

  create(name: string, description: string) {
    return this.api
      .createProjectGroup({ name, description })
      .pipe(tap((x) => this.upsert(x)));
  }

  edit(id: string, name: string, description: string) {
    return this.api
      .editProjectGroup(id, { name, description })
      .pipe(tap((x) => this.upsert(x)));
  }

  delete(id: string) {
    return this.api
      .deleteProjectGroup(id)
      .pipe(
        tap(() =>
          this.groupsSubject.next(
            this.groupsSubject.getValue().filter((x) => x.id !== id),
          ),
        ),
      );
  }

  memberships(id: string): Observable<ProjectGroupMembership[]> {
    return this.api.getProjectGroupMemberships(id);
  }

  addMembership(id: string, command: CreateProjectGroupMembershipCommand) {
    return this.api.createProjectGroupMembership(id, command);
  }

  editMembership(membershipId: string, roleId: string) {
    return this.api.editProjectGroupMembership(membershipId, { roleId });
  }

  removeMembership(membershipId: string) {
    return this.api.deleteProjectGroupMembership(membershipId);
  }

  addProject(id: string, projectId: string) {
    return this.api
      .addProjectToProjectGroup(id, projectId)
      .pipe(tap((x) => this.upsert(x)));
  }

  removeProject(id: string, projectId: string) {
    return this.api
      .removeProjectFromProjectGroup(id, projectId)
      .pipe(tap((x) => this.upsert(x)));
  }

  setPartition(id: string, partitionId: string | null) {
    return this.api
      .setProjectGroupPartition(id, { partitionId })
      .pipe(tap((x) => this.upsert(x)));
  }

  private upsert(group: ProjectGroup) {
    const groups = this.groupsSubject
      .getValue()
      .filter((x) => x.id !== group.id);
    this.groupsSubject.next(
      [...groups, group].sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', undefined, {
          sensitivity: 'base',
        }),
      ),
    );
  }
}

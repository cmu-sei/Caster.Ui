// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ProjectRole, ProjectRolesService } from 'src/app/generated/caster-api';

@Injectable({
  providedIn: 'root',
})
export class ProjectRoleService {
  private projectRolesService = inject(ProjectRolesService);

  private projectRolesSubject = new BehaviorSubject<ProjectRole[]>([]);
  public projectRoles$ = this.projectRolesSubject.asObservable();

  loadRoles(): Observable<ProjectRole[]> {
    return this.projectRolesService
      .getAllProjectRoles()
      .pipe(tap((x) => this.projectRolesSubject.next(x)));
  }
}
